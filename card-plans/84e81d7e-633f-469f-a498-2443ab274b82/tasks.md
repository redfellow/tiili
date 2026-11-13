# Tasks

- [ ] 1.1 Take `docs/brand/logo/lockup-dark.svg`, `docs/brand/logo/lockup-light.svg` and the README header change from `origin/docs/readme-lockup`
  - proof: `git diff --exit-code origin/docs/readme-lockup -- docs/brand/logo/lockup-dark.svg docs/brand/logo/lockup-light.svg README.md`
  - proof: `node -e "const {Resvg}=require('@resvg/resvg-js');const fs=require('fs');for(const f of ['docs/brand/logo/lockup-dark.svg','docs/brand/logo/lockup-light.svg']){const p=new Resvg(fs.readFileSync(f,'utf8')).render();if(!p.width||!p.height)throw f;console.log(f,p.width,p.height)}"`
- [ ] 1.2 List `lockup-{light,dark}.svg` in the logo files line of `docs/brand/README.md`
  - proof: `grep -n "lockup-" docs/brand/README.md`

## Manual checks after merge (The user)
- View the README on GitHub in light and dark theme; the matching lockup shows, centred, crisp.
- Close PR redfellow/tiili#52 as superseded.
