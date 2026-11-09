# Flash: handling this kit safely

The six `models/w*.glb` are new, structurally valid **development** meshes, but their appearance fails the user's premium model fidelity goal. Do not put them into the production `Ancient Battlefield` option. They are deliberately NOT drop-in replacements and do NOT constitute an accepted 3D army.

1. If doing development comparisons, create a dedicated preview route or use `/models/astra-dev-v01/` on a throwaway branch. Copy these `w*.glb` only to that experimental directory and preserve your existing `public/models/astra/` assets.
2. The existing `PieceBuilder3D` hardcodes the `public/models/astra/` path. Use an asset-manifest parameter to select the experimental path, rather than overwriting shared files or changing authoritative chess state.
3. Keep the 2D fallback. Display `Experimental geometry` in the preview. Do not advertise attack, break or rigging completeness; none of these animations are authored in this asset kit.
4. Source script creates named weapon **transform groups**, which need actual rig parenting before animation. `wN`'s body is still an assembled approximated shape. Do not use this model to claim the horse-anatomy gate passed.
5. For production fidelity, replace the mesh with a real sculpted organic model. The included visual references and `ASSET_HANDOFF.md` establish silhouettes, class distinctions and naming. Reuse mature open-source/CC0 source models where possible, after checking licenses, or author original sculpts in Blender.
6. Request normal-size board screenshots, a 360-degree turnaround, real capture recording, and frame time measurements before promoting any asset revision.
