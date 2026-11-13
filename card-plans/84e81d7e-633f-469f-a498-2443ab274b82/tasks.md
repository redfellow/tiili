# Tasks

- [x] 1.1 Take `docs/brand/logo/lockup-dark.svg` and `docs/brand/logo/lockup-light.svg` unchanged from `origin/docs/readme-lockup`
  - proof: `git diff --exit-code origin/docs/readme-lockup -- docs/brand/logo/lockup-dark.svg docs/brand/logo/lockup-light.svg`
  - proof: `node -e "const {Resvg}=require('@resvg/resvg-js');const fs=require('fs');for(const f of ['docs/brand/logo/lockup-dark.svg','docs/brand/logo/lockup-light.svg']){const p=new Resvg(fs.readFileSync(f,'utf8')).render();if(!p.width||!p.height)throw f;console.log(f,p.width,p.height)}"`
- [x] 1.2 Replace the README header (mark `<picture>` and `<h1>tiili</h1>`) with the centred lockup `<picture>` from the branch
  - proof: `grep -c 'lockup-dark.svg' README.md`
  - proof: `! grep -n '<h1>tiili</h1>' README.md`
- [x] 1.3 List `lockup-{light,dark}.svg` in the logo files line of `docs/brand/README.md`
  - proof: `grep -n "lockup-" docs/brand/README.md`

## Manual checks after merge (The user)
- View the README on GitHub in light and dark theme; the matching lockup shows, centred, crisp.
- Close PR redfellow/tiili#52 as superseded.
