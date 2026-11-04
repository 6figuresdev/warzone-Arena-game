# Warzone Arena

A first-person tactical shooter that runs in the browser. Survive escalating waves of hostiles in a ruined compound, then stake USDC on a timed round: the best verified score takes the whole pot. Practice mode needs no wallet.


## Features

- Ten-stage campaign. Each stage is a heist: beat the thieves wave by wave, run to the glowing money case and hold it to secure the stolen funds. Stage 1 recovers $500, stage 2 $1,000, and so on up to $5,000 in stage 10, where the campaign ends. Progress, unlocked stages and your weapons are saved in the browser. Campaign funds are in-game only. A round minimap shows the USDC money-bag pin, your squad and the thieves, and M opens a full tactical map.
- Wave-based combat in third person (switchable to first person) against large groups of armed soldiers, with a two-man AI squad that talks over the radio, spots contacts and fights beside you. Hold or follow orders with a key press.
- Three battlefields: a burnt-out town, a container port and a desert outpost, with wrecked cars, ruined buildings, smoke, and enemies who ambush from behind cover.
- Six weapons, grenades, armor, sprint, jump, aim down sights, radar, kill streaks and a UAV reward.
- An in-game buy station: earn cash from kills and wave bonuses, then buy weapons, ammo, armor and medkits. Cash is in-game only and never touches USDC.
- Free practice runs with no wallet.
- Ranked rounds on Arc Testnet: enter with a USDC entry fee, post a referee-verified score, claim the pot if you win, or get refunded if nobody scores.

## Controls

WASD move, Shift sprint, C crouch, Space jump, mouse aim and fire, right click aim down sights, R reload, 1-6, Q or wheel switch weapon, G frag grenade, B buy station, V first or third person, T squad hold or follow, left and right arrows or the on-screen Turn buttons turn faster the longer you hold them, X is a quick 180 degree turn, Esc pause, which also opens a command guide with a keyboard tab and an on-screen buttons tab. If your browser blocks mouse capture, on-screen controls appear automatically (movement stick, drag to look, fire, aim, jump and action buttons). They also work on touch screens and can be toggled from the pause menu, along with look sensitivity.

## Tech stack

React, TypeScript, Vite, Tailwind CSS, three.js, wagmi, viem, ConnectKit, Solidity (Foundry), Bun.

## Development

Prerequisites: Bun and Foundry.

```bash
bun install
bun run dev        # game on http://localhost:5173
bun run server     # referee service on port 3001 (proxied at /api)
bun run check      # lint and typecheck
forge build        # compile contracts
```

The game needs both the dev server and the referee service running for ranked play.

### Environment variables

- `VITE_ARENA_ADDRESS`: deployed arena contract address (public).
- `REFEREE_PRIVATE_KEY`: key the referee service uses to sign score attestations. Server only, never commit it.
- `VITE_REFEREE_ADDRESS`: public address of the referee key.
- `REFEREE_PORT`: referee service port, defaults to 3001. Optional.
- `RPC_PROXY_BASE_URL`, `RPC_PROXY_TOKEN`, `RPC_PROXY_CHAINS`: provisioned by Arc Studio for RPC access. Optional outside Arc Studio, the service falls back to the public Arc Testnet RPC.

## Notes

Scores are checked and signed by the referee service before the contract accepts them. This is a testnet demo and does not provide tamper-proof anti-cheat.

## Performance flags

Add `?lowfx` to the URL to turn off antialiasing and shadows on weak machines.

## Credits

- Soldier model: Grab3D "Soldier" (CC0), simplified and re-textured at 1K for the web.
- Textures and HDRI skies: Poly Haven (CC0).

## Deploying

The game is a static Vite site: build command `bun run build` (or `vite build`), output folder `dist`. The campaign and free practice work on any static host. Ranked rounds also need:

- `VITE_ARENA_ADDRESS` set in the host's environment variables (the deployed arena contract address).
- The referee service (`bun run server`) running somewhere reachable and the host forwarding `/api/*` to it. Without it, ranked rounds show a clear message and everything else still works.
