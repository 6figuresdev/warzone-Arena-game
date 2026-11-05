# Warzone Arena

**Warzone Arena is a money-heist tactical shooter that runs in your browser.**

A syndicate of thieves has stolen money across ten heists, from a corner store to the Syndicate Vault. You lead a three-person squad into burnt-out towns, container ports and desert forts to hunt the thieves down, then fight your way to the stolen USDC money bag and secure it before time runs out. Every stage recovers more than the last, from $500 in Stage 1 up to $5,000 in Stage 10, $27,500 in total.

Prefer to compete? Ranked rounds put real stakes on the line: players pay a small USDC entry fee into a shared pot on Arc Testnet, and the best referee-verified score wins the whole pot.

No downloads, no account and no wallet are needed to play the campaign or free practice.

## Game modes

| Mode | What it is | Wallet needed |
| --- | --- | --- |
| **Campaign** | Ten heist stages. Clear the thieves, recover the money bag, unlock the next stage. | No |
| **Free practice** | Endless waves on any map to learn the weapons. | No |
| **Ranked rounds** | Stake USDC on a timed round. Highest verified score takes the pot. | Yes (Arc Testnet) |

## How to play the campaign

Every stage follows the same mission:

1. **Read the briefing.** Choose a stage on the Campaign tab. The briefing shows how much was stolen, the location, how many thieves are on the map and your time limit.
2. **Deploy.** Click the game to take control. Your squad, Ghost and Viper, spawns beside you, and Command talks you through the mission over the radio.
3. **Clear the thieves.** Each stage has two to five waves. Some thieves rush you, others hold back, and some hide crouched behind wrecked cars and containers until you get close. Watch the radar and listen to your squad.
4. **Recover the money bag.** After the last wave, the stolen USDC money bag appears with a green beam of light. A pin on your minimap, a marker on screen and the full map (press **M**) show the way and the distance.
5. **Hold the bag.** Stand on the bag for a few seconds to secure the funds. Reinforcements attack while you hold, so bring your squad and keep your head down.
6. **Collect your reward.** Each cleared stage pays bonus cash worth half the recovered funds, and unlocks the next stage. Your cash and weapons carry over.

You fail the stage if you are killed or the timer runs out. You can retry as many times as you like. Clearing Stage 10 ends the campaign.

### The ten heists

| Stage | Funds stolen |
| --- | --- |
| 1 | $500 |
| 2 | $1,000 |
| 3 | $1,500 |
| 4 | $2,000 |
| 5 | $2,500 |
| 6 | $3,000 |
| 7 | $3,500 |
| 8 | $4,000 |
| 9 | $4,500 |
| 10 | $5,000 |

Stages 1 to 3 take place in a burnt-out town, 4 to 6 at a container port, and 7 to 9 at a desert outpost. Stage 10 returns to the town for the final showdown. Campaign funds are in-game values and are never real money.

## Controls

| Action | Keyboard and mouse | Touch or on-screen |
| --- | --- | --- |
| Move | W A S D | Move pad arrows, or drag on the left side |
| Look | Mouse | Drag on the right side |
| Fire | Left click | Fire button |
| Aim down sights | Right click | Aim button |
| Sprint | Hold Shift | Run button, or push the stick fully forward |
| Jump | Space | Jump button |
| Crouch | C | Actions menu |
| Reload | R | Reload button |
| Throw frag grenade | G | Actions menu |
| Switch weapon | 1 to 6, Q or mouse wheel | Actions menu |
| Buy station | B | Actions menu |
| Map and money bag | M | Actions menu |
| First or third person | V | Actions menu |
| Squad: hold or follow | T | Actions menu |
| Turn left or right | Left and right arrows, hold to turn faster | Turn buttons |
| Quick 180 degree turn | X | Actions menu |
| Pause and command guide | Esc | Pause from the menu |

If your browser blocks mouse capture, the on-screen controls appear automatically. The arrows on the move pad light up when the game hears your keyboard. If they stay dark, click the game or the gold "Click here to turn on the keyboard" button.

## Tips from the squad

- **Use cover.** Crouch behind cars and barriers. Thieves find it harder to hit a crouched target.
- **Check the radar.** Red dots show nearby thieves and blue dots show your squad. Hidden ambushers only appear once they stand up, or during a UAV.
- **Listen to the radio.** Ghost and Viper call out contacts by direction, warn you when you are hurt and tell you when they are reloading.
- **Order your squad.** Press **T** to make them hold a position while you scout, or follow you into a fight.
- **Spend between waves.** Press **B** at any time to open the buy station. Cash comes from kills, headshots and wave-clear bonuses.
- **Build a kill streak.** Five kills in quick succession call in a UAV for 20 seconds that widens your radar and reveals every thief, including the ones hiding.
- **Shoot the head.** Headshots do far more damage and earn bonus points.
- **Do not rush the bag.** Clear your surroundings first, because reinforcements arrive as soon as you start securing the funds.

## Arsenal and buy station

You start each campaign with the AR-7 assault rifle and a P-9 pistol and $800 in cash. Unlock more at the buy station:

| Item | Cost |
| --- | --- |
| MP-9 Viper submachine gun | $900 |
| M12 Breaker shotgun | $1,100 |
| KR-98 Longbow sniper rifle | $1,900 |
| M60 Hammer light machine gun | $2,600 |
| Ammo resupply | $350 |
| Trauma kit (full health) | $300 |
| Plate carrier armor | $700 |
| Frag grenades | $250 |

Buy-station cash is in-game only and never touches USDC.

## Ranked rounds

Ranked rounds are the competitive side of Warzone Arena, played on Arc Testnet with testnet USDC:

1. Connect a wallet and enter the current round with a 0.5 USDC entry fee.
2. Play a ranked run. The score comes from kills, headshots, waves survived and time alive.
3. A referee service checks that the run is plausible and signs your score, then you submit it to the contract.
4. When the round closes, the highest verified score claims the whole pot. If nobody scores, or the winner cannot be paid, entrants can take their entry back.

The referee can only vouch for scores. It cannot move funds. This is a testnet demo and does not provide tamper-proof anti-cheat.

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
- First-person hand model: anatomical right hand based on MakeHuman (CC0), via Innerscene.
- Textures and HDRI skies: Poly Haven (CC0).

## Deploying

The game is a static Vite site: build command `bun run build` (or `vite build`), output folder `dist`. The campaign and free practice work on any static host. Ranked rounds also need:

- `VITE_ARENA_ADDRESS` set in the host's environment variables (the deployed arena contract address).
- The referee service (`bun run server`) running somewhere reachable and the host forwarding `/api/*` to it. Without it, ranked rounds show a clear message and everything else still works.

The 3D soldier model, the first-person human hand model (CC0, based on MakeHuman), textures and sky images live in `public/assets/`. Text copies, split into small parts, are kept in `asset-pack/`, and the build rebuilds any missing binary file from them (`node tools/restore-assets.mjs`), so committing `asset-pack/` is enough even if binary files get skipped. The build stops with a list if anything is still missing.
