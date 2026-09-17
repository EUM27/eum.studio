# T070 first bridge-contract split

The canonical public facade remains `src/application/contracts/studio-bridge.ts`; `renderer/global.d.ts`, preload, desktop main, and all consumers continue importing it. The first mechanical split is fragments, not publishing: fragments has one contract import, six channels/methods, one public namespace, and no cross-feature contract graph. Publishing currently spans 15 imports, 39 channels, and 14 namespaces and is deferred.

## Exact fragment ownership

- contract import: current facade lines 233-250
- six channel constants: 985-996
- `StudioBridge.fragments`: 1467-1484
- `BridgeInvoke` channel refs: 2103-2108
- payload refs: 2315-2319
- factory object: 3072-3126
- facade test: `studio-bridge.test.ts:2126-2207`

Create `src/application/contracts/bridge/fragments-bridge.ts` owning the six exact constants, internal FragmentBridge/FragmentBridgeInvoke types, and unchanged parser/try-catch/error factory. The facade imports and named re-exports only the existing public constants, keeps `StudioBridge`, `BridgeInvoke`, and `BridgeListen` declarations/public shapes unchanged, and replaces only the inline object with `createFragmentsBridge(invoke)`. Do not use `export *`.

## Baseline proofs

- channel manifest: `6947738E8FA65B33307109D63AC3079FB400F0A1AE9D461FCBB955B4B8FC12FF`
- fragment public shape: `2022BCC13AE6A49C52C640704255CAAFE75952CAC33AC4B67646A8A0D631FAEC`
- factory object: `5C4D463710C1060ABBDE07E448249D687BAEA3135D79DF2CA04DAAA1994DB55D`
- full StudioBridge: `D36058E30108D52C2E733CBD8CB774DC40E00207FA83E5BC4308DCC8D4273B9F`
- full BridgeInvoke: `189921334356237F78AE195BBEC2D2A1802FF2DEE8668C2B3D1738B58E576911`
- full BridgeListen: `F42C4BC142B75D735117AD5542D0786FC717322DECF1DF39BEA420DAE3ED3482`
- 240 sorted facade export names: `5587DE3213F1B3B5D958719BD49D593BE521AFB35E97E6E3361E19CDACA96FC5`
- 230 sorted channel name/value pairs: `3459CF048C5AD6881C8390D9C97CD0156373DC332DB6D1D88B9481811FD2524D`

Allowed files are the facade and new fragment bridge file only. Verify normalized hashes/counts, fragment and facade tests, full typecheck/lint/build/test, three fragment Electron flows, and zero diff in preload/main/global declarations.

Stop on any public export/count/string/shape drift, parser/catch/error drift, hierarchy inversion, preload/main/global change, sender-policy change, or an attempt to repair the existing publishing payload-union asymmetry. Preload and main registrar extraction are later separate slices.
