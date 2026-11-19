//! The macOS Dock menu (right-click or long-press tiili's Dock icon): New Window, above the system items, opens a
//! tiili window on the current Space and focuses it. tao's app delegate has no `applicationDockMenu:`, so it is added
//! to the delegate's class at start.

use std::cell::OnceCell;
use std::sync::OnceLock;

use objc2::rc::Retained;
use objc2::runtime::{AnyObject, Imp, Sel};
use objc2::{define_class, msg_send, sel, MainThreadMarker, MainThreadOnly};
use objc2_app_kit::{NSApplication, NSMenu, NSMenuItem};
use objc2_foundation::{ns_string, NSObject, NSObjectProtocol};
use tauri::AppHandle;

/// The app the Dock menu's New Window opens a window in.
static APP: OnceLock<AppHandle> = OnceLock::new();

thread_local! {
    /// The Dock menu and its item's target, kept alive here: a menu item holds its target weakly, and
    /// `applicationDockMenu:` hands the menu out without passing ownership.
    static DOCK_MENU: OnceCell<(Retained<NSMenu>, Retained<DockTarget>)> = const { OnceCell::new() };
}

define_class!(
    // SAFETY: NSObject has no subclassing requirements, and DockTarget does not implement Drop.
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "TiiliDockTarget"]
    struct DockTarget;

    unsafe impl NSObjectProtocol for DockTarget {}

    impl DockTarget {
        /// The Dock menu's New Window was chosen.
        #[unsafe(method(newWindow:))]
        fn new_window(&self, _sender: Option<&AnyObject>) {
            if let Some(app) = APP.get() {
                crate::windows::open_from_launcher(app);
            }
        }
    }
);

impl DockTarget {
    fn new(mtm: MainThreadMarker) -> Retained<Self> {
        // SAFETY: `init` is NSObject's designated initialiser and DockTarget has no instance variables.
        unsafe { msg_send![Self::alloc(mtm), init] }
    }
}

/// `applicationDockMenu:` on tao's app delegate: the menu [`install`] built.
extern "C-unwind" fn application_dock_menu(
    _delegate: &AnyObject,
    _cmd: Sel,
    _sender: *mut AnyObject,
) -> *mut NSMenu {
    DOCK_MENU.with(|kept| {
        kept.get().map_or(std::ptr::null_mut(), |(menu, _)| {
            Retained::as_ptr(menu).cast_mut()
        })
    })
}

/// Gives tiili's Dock icon its menu. Runs on the main thread in `setup`, after tao has set its app delegate; when the
/// delegate already has a Dock menu (a later tao), it is left alone and the reason logged.
pub fn install(app: &AppHandle) {
    let Some(mtm) = MainThreadMarker::new() else {
        eprintln!("tiili: no Dock menu: not on the main thread");
        return;
    };
    let ns_app = NSApplication::sharedApplication(mtm);
    let Some(delegate) = ns_app.delegate() else {
        eprintln!("tiili: no Dock menu: the app has no delegate");
        return;
    };
    let _ = APP.set(app.clone());
    let target = DockTarget::new(mtm);
    // SAFETY: `newWindow:` is DockTarget's method, taking the sender, and `target` outlives the item (DOCK_MENU).
    let item = unsafe {
        let item = NSMenuItem::initWithTitle_action_keyEquivalent(
            NSMenuItem::alloc(mtm),
            ns_string!("New Window"),
            Some(sel!(newWindow:)),
            ns_string!(""),
        );
        item.setTarget(Some(&target));
        item
    };
    let menu = NSMenu::new(mtm);
    menu.addItem(&item);
    if DOCK_MENU.with(|kept| kept.set((menu, target))).is_err() {
        return;
    }
    let object: &AnyObject = delegate.as_ref();
    let class = object.class();
    // SAFETY: `application_dock_menu` has the C signature of `-(NSMenu *)applicationDockMenu:(NSApplication *)`,
    // which the type encoding `@@:@` names, and the class lives as long as the app.
    let added = unsafe {
        let imp: Imp =
            std::mem::transmute(application_dock_menu as extern "C-unwind" fn(_, _, _) -> _);
        objc2::ffi::class_addMethod(
            (class as *const objc2::runtime::AnyClass).cast_mut(),
            sel!(applicationDockMenu:),
            imp,
            c"@@:@".as_ptr(),
        )
    };
    if !added.as_bool() {
        eprintln!("tiili: no Dock menu: the app delegate already has one");
        return;
    }
    // AppKit may have noted what the delegate answers to when it was set; setting it again makes it ask anew.
    ns_app.setDelegate(None);
    ns_app.setDelegate(Some(&delegate));
}
