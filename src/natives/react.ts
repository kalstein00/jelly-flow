import {isCallExpression, isExpression, isOptionalCallExpression} from "@babel/types";
import {NativeObjectToken} from "../analysis/tokens";
import {locationToStringWithFile} from "../misc/util";
import {options} from "../options";
import {NativeModelParams} from "./nativebuilder";
import {returnArgument} from "./nativehelpers";

/**
 * Additive, opt-in model of the public React 18.3.1 entry. Module identity comes
 * from the resolver's package metadata, never from an identifier's spelling.
 * Keep the implementation and all other exports in the normal analysis.
 */
export function addReactCallbackModel(p: NativeModelParams) {
    const {moduleInfo: m, solver} = p;
    if (!options.reactCallbackModel || !options.natives ||
        m.packageInfo.name !== "react" || m.packageInfo.version !== "18.3.1" ||
        m.relativePath !== "index.js")
        return;

    const evidence = {model: "react.useCallback/1", module: m.getPath(),
        version: m.packageInfo.version, relation: "return-argument" as const,
        argument: 0, implementationAnalyzed: true, calls: [] as Array<string>};
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
