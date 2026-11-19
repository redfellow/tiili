//! The Windows taskbar jump list: a Tasks group with New Window, which starts tiili with `--new-window`, so the
//! running tiili opens a window (see [`crate::launch`]). Written at every start, so the task follows the app's path
//! after an update.

use std::mem::ManuallyDrop;
use std::path::Path;

use windows::core::{Interface, HSTRING, PWSTR};
use windows::Win32::Storage::EnhancedStorage::PKEY_Title;
use windows::Win32::System::Com::StructuredStorage::{
    PROPVARIANT, PROPVARIANT_0, PROPVARIANT_0_0, PROPVARIANT_0_0_0,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER,
    COINIT_APARTMENTTHREADED,
};
use windows::Win32::System::Variant::VT_LPWSTR;
use windows::Win32::UI::Shell::Common::{IObjectArray, IObjectCollection};
use windows::Win32::UI::Shell::PropertiesSystem::IPropertyStore;
use windows::Win32::UI::Shell::{
    DestinationList, EnumerableObjectCollection, ICustomDestinationList, IShellLinkW, ShellLink,
};

use crate::launch::NEW_WINDOW_ARG;

/// Writes the jump list on a thread of its own, so start-up never waits for the shell; a failure is logged.
pub fn write() {
    std::thread::spawn(|| {
        if let Err(error) = write_list() {
            eprintln!("tiili: could not write the taskbar jump list: {error}");
        }
    });
}

fn write_list() -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    // SAFETY: COM is initialised on this thread for the calls in `add_task` and uninitialised after them.
    unsafe {
        CoInitializeEx(None, COINIT_APARTMENTTHREADED)
            .ok()
            .map_err(|e| e.to_string())?;
        let result = add_task(&exe);
        CoUninitialize();
        result.map_err(|e| e.to_string())
    }
}

/// Replaces the jump list's tasks with New Window: `exe --new-window`, with the app's icon.
///
/// # Safety
///
/// COM must be initialised on the calling thread.
unsafe fn add_task(exe: &Path) -> windows::core::Result<()> {
    unsafe {
        let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)?;
        let exe = HSTRING::from(exe);
        link.SetPath(&exe)?;
        link.SetArguments(&HSTRING::from(NEW_WINDOW_ARG))?;
        link.SetIconLocation(&exe, 0)?;
        link.SetDescription(&HSTRING::from("Open a new tiili window"))?;
        // A task's title is the link's Title property; `title` outlives `SetValue`, which copies it.
        let mut title: Vec<u16> = "New Window".encode_utf16().chain([0]).collect();
        let value = PROPVARIANT {
            Anonymous: PROPVARIANT_0 {
                Anonymous: ManuallyDrop::new(PROPVARIANT_0_0 {
                    vt: VT_LPWSTR,
                    wReserved1: 0,
                    wReserved2: 0,
                    wReserved3: 0,
                    Anonymous: PROPVARIANT_0_0_0 {
                        pwszVal: PWSTR(title.as_mut_ptr()),
                    },
                }),
            },
        };
        let store: IPropertyStore = link.cast()?;
        store.SetValue(&PKEY_Title, &value)?;
        store.Commit()?;
        let tasks: IObjectCollection =
            CoCreateInstance(&EnumerableObjectCollection, None, CLSCTX_INPROC_SERVER)?;
        tasks.AddObject(&link)?;
        let list: ICustomDestinationList =
            CoCreateInstance(&DestinationList, None, CLSCTX_INPROC_SERVER)?;
        let mut slots = 0u32;
        let _removed: IObjectArray = list.BeginList(&mut slots)?;
        list.AddUserTasks(&tasks)?;
        list.CommitList()
    }
}
