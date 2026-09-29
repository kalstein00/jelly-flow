import {isCallExpression, isExpression, isOptionalCallExpression} from "@babel/types";
import {NativeObjectToken} from "../analysis/tokens";
import {locationToStringWithFile} from "../misc/util";
import {options} from "../options";
import {NativeModelParams} from "./nativebuilder";
import {returnArgument} from "./nativehelpers";
import {ModuleInfo} from "../analysis/infos";
import type Solver from "../analysis/solver";
import {IgnoredAccessPath} from "../analysis/accesspaths";

function isSupportedReact(m: ModuleInfo) {
    return m.packageInfo.name === "react" && m.packageInfo.version === "18.3.1" && m.relativePath === "index.js";
}

/** Prepare a React export boundary without parsing/executing its implementation. */
export function buildExternalReactModel(solver: Solver, m: ModuleInfo): boolean {
    if (!options.appOnly || !options.natives || m.isIncluded || !isSupportedReact(m)) return false;
    if (solver.globalState.modeledExternalModules.has(m)) return true;
    solver.globalState.modeledExternalModules.add(m);
    const exports = solver.globalState.canonicalizeToken(new NativeObjectToken("exports", m));
    const mod = solver.globalState.canonicalizeToken(new NativeObjectToken("module", m));
    solver.addTokenConstraint(exports, solver.varProducer.objPropVar(mod, "exports"));
    solver.addTokenConstraint(exports, solver.varProducer.objPropVar(exports, "default"));
    addReactCallbackModel({solver, moduleInfo: m, moduleSpecialNatives: {exports},
        globalSpecialNatives: solver.globalState.globalSpecialNatives!});
    return true;
}

/** Other requested React exports remain unknown instead of silently disappearing. */
export function prepareExternalReactProperty(solver: Solver, base: NativeObjectToken, prop: string) {
    if (base.name === "exports" && base.moduleInfo && solver.globalState.modeledExternalModules.has(base.moduleInfo) &&
        prop !== "useCallback" && prop !== "default")
        solver.addAccessPath(IgnoredAccessPath.instance, solver.varProducer.objPropVar(base, prop));
}

/**
 * Public React 18.3.1 model: additive with --react-callback-model in full mode,
 * automatically installed at the excluded module boundary with --app-only. Identity comes
 * from the resolver's package metadata, never from an identifier's spelling.
 * Full mode keeps the implementation; app-only mode leaves other exports unknown.
 */
export function addReactCallbackModel(p: NativeModelParams) {
    const {moduleInfo: m, solver} = p;
    if ((!options.reactCallbackModel && !options.appOnly) || !options.natives || !isSupportedReact(m))
        return;

    const evidence = {model: "react.useCallback/1", module: m.getPath(),
        version: m.packageInfo.version!, relation: "return-argument" as const,
        argument: 0, implementationAnalyzed: m.isIncluded, calls: [] as Array<string>};
    solver.diagnostics.libraryModels.push(evidence);
    const token = solver.globalState.canonicalizeToken(new NativeObjectToken("react.useCallback", m, call => {
        if ((isCallExpression(call.path.node) || isOptionalCallExpression(call.path.node)) &&
            call.callArgs !== call.path.node.arguments) {
            call.solver.fragmentState.warnUnsupported(call.path.node,
                "React useCallback model does not support indirect call/apply invocation");
            return;
        }
        // React returns the callback; the model must not invoke it. Rerender
        // identity/dependency comparison is outside this flow-insensitive model.
        const arg = call.callArgs[0];
        if (arg && isExpression(arg)) {
            returnArgument(arg, call);
            const location = locationToStringWithFile(call.path.node.loc);
            if (!evidence.calls.includes(location))
                evidence.calls.push(location);
        } else if (arg)
            call.solver.fragmentState.warnUnsupported(call.path.node,
                "React useCallback model does not support a spread first argument");
    }));
    solver.addTokenConstraint(token, solver.varProducer.objPropVar(p.moduleSpecialNatives.exports, "useCallback"));
}
