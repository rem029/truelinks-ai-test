# Sample photo prompts

The sample photos are AI-generated (none were provided with the brief). Each scenario is designed to exercise a specific behaviour of the issue agent, and is linked to a unit that has a sample lease.

Save each image as `<scenario>-<n>.jpg` in this folder (e.g. `issue-01-ac-leak-1.jpg`).

**Style suffix — append to every prompt:**
> Realistic smartphone photo taken by a tenant, natural indoor lighting, slightly imperfect framing, modern apartment in Doha, Qatar. No people, no text, no watermark. 4:3 aspect ratio.

---

## issue-01-ac-leak — MC-B-1204 (lease 01)
Tests: equipment identification (split AC), damage detection, HVAC work order. Landlord responsible per lease §7.

1. `issue-01-ac-leak-1.jpg` — Wide shot of a bedroom wall with a white wall-mounted split air-conditioning unit near the ceiling. A brown water stain runs down the wall below it, and there is a small puddle on the light grey floor tiles.
2. `issue-01-ac-leak-2.jpg` — Close-up of the bottom edge of a white wall-mounted split AC unit with water droplets dripping from the vent and yellowish discoloration on the plastic casing.

## issue-02-tap-drip — MC-B-0902 (lease 02)
Tests: minor issue; agent should read lease §7 ("minor repairs under QAR 500 are the Tenant's responsibility") and note likely tenant responsibility.

1. `issue-02-tap-drip-1.jpg` — Close-up of a chrome kitchen mixer tap over a stainless steel sink, a drop of water falling from the spout, white limescale build-up around the base of the tap.
2. `issue-02-tap-drip-2.jpg` — Inside an open under-sink kitchen cabinet: water pipes, a small plastic bowl catching drips, slightly damp cabinet floor panel.

## issue-03-water-heater — MC-A-0301 (lease 04)
Tests: high severity (water + electricity), worn/old condition, equipment identification. Landlord responsible per lease §6.

1. `issue-03-water-heater-1.jpg` — A white wall-mounted cylindrical electric water heater (about 80 litres) in a bathroom utility corner, with orange-brown rust streaks at the bottom seam and around the pipe connections.
2. `issue-03-water-heater-2.jpg` — Close-up of the bottom of the same water heater showing corrosion on the pipe fittings, water dripping, and a puddle on the tiled floor next to an electrical outlet.

## issue-04-move-in-ok — MC-B-1204 (lease 01)
Tests: no false positives. Condition should be "new/good", full equipment inventory, and the agent should say no issue was found and not draft a work order.

1. `issue-04-move-in-ok-1.jpg` — Clean, newly finished living room in an empty apartment: white walls, light grey floor tiles, a new white wall-mounted split AC unit, large window with a view of Lusail marina.
2. `issue-04-move-in-ok-2.jpg` — Brand new modern kitchen with white cabinets, built-in stainless steel oven, four-burner hob, extractor hood, and a tall stainless steel refrigerator. Everything spotless.

## issue-05-unclear — MC-A-0301 (lease 04)
Tests: uncertainty. Photo is too dark/blurry to judge; agent should ask for a clearer photo, not guess.

1. `issue-05-unclear-1.jpg` — Blurry, underexposed photo of a bathroom ceiling corner taken at night with camera shake; a possible dark crack or stain is barely visible.
