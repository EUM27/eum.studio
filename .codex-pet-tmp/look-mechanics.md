# Patchbit look mechanics

Patchbit is a rigid rounded terminal-toolbox robot with a flat black display face, cyan screen-drawn eyes and mouth, an orange-red top handle, fixed side modules, flexible magenta/cyan cable arms with plug ends, and compact planted mechanical feet.

## Natural gaze mechanism

- Keep both feet, the lower chassis, body scale, baseline, and screen position anchored throughout the loop.
- Preserve the front-readable black display. The cyan screen eyes lead the gaze by sliding and reshaping inside their original display apertures; they are flat display features, not physical eyeballs. Never add sclera, pupils, googly eyes, a nose, or a second eye layer.
- The upper chassis and display plane may use a very small physically coherent yaw for left/right and pitch for up/down, while remaining recognizably front-facing. Do not rotate, skew, tilt, or translate the complete sprite.
- The top handle and rigid side modules follow the chassis exactly. Side-surface visibility and occlusion change gradually with yaw; neither side module may swap sides or detach.
- Cable arms remain attached at their existing chassis sockets. Their curves and plug ends lag the upper-body change slightly and continuously, with no flipping, teleporting, detached effects, or new gestures. The cables support the motion but do not carry the gaze by themselves.
- The cyan mouth may react subtly to pitch but must keep Patchbit's calm identity and must not replace the eye-direction cue.

## Cardinal pose families

- `000 up`: face remains broadly frontal; both cyan eyes sit clearly above their neutral display position and the upper display/chassis pitches slightly toward the top edge. The handle and cables follow subtly; feet stay fixed.
- `090 screen-right`: both cyan eyes shift unmistakably toward the viewer's right side of the display. The upper chassis yaws slightly toward screen-right, with gradual side-module occlusion and cable follow-through. The display remains readable and the lower body stays planted.
- `180 down`: face remains broadly frontal; both cyan eyes sit clearly below neutral and the upper display/chassis pitches slightly toward the bottom edge. The handle and cables follow subtly; feet stay fixed.
- `270 screen-left`: inverse of `090`; both cyan eyes shift unmistakably toward the viewer's left side of the display and the upper chassis yaws slightly toward screen-left. Side-module occlusion and cable curves progress continuously without swapping or detaching.

## Motion budget and continuity

Each 22.5-degree step changes the eye placement, eyelid/eye-tile shape, small upper-chassis yaw or pitch, side visibility, and cable curvature by roughly the same visual amount. No adjacent step may introduce a larger body bend, scale change, baseline jump, prop shift, expression reset, or silhouette change. `157.5 -> 180`, `337.5 -> 000`, and the row boundary must each read as one ordinary step in the same clockwise loop.

The result must preserve Patchbit's exact off-white chassis, black display, cyan facial marks, orange-red handle, multicolor buttons/modules, magenta/cyan cables and plugs, compact feet, proportions, lighting, and high-detail 3D-toy rendering from the existing atlas.
