import {isBooleanLiteral, isNullLiteral, isNumericLiteral, isStringLiteral, isUnaryExpression, Node} from "@babel/types";
import {NativeFunctionParams} from "./nativebuilder";
import {MAP_KEYS, MAP_UNKNOWN_VALUES, MAP_VALUES} from "./ecmascript";
import {assignParameterToThisProperty, returnThis, returnThisProperty, spreadIndex} from "./nativehelpers";

/** Only syntactic primitive literals are separated. Other expressions fall back. */
function keyProperty(key: Node | undefined): string | undefined {
    let value: string | undefined;
    if (isStringLiteral(key)) value = `string:${key.value}`;
    else if (isNumericLiteral(key)) value = `number:${key.value}`;
    else if (isBooleanLiteral(key)) value = `boolean:${key.value}`;
    else if (isNullLiteral(key)) value = "null";
    else if (isUnaryExpression(key) && key.operator === "-" && isNumericLiteral(key.argument))
        value = `number:${-key.argument.value}`; // includes SameValueZero's -0 = 0
    return value === undefined ? undefined : `%MAP_KEY:${value}`;
}

export function mapGet(p: NativeFunctionParams) {
    const key = keyProperty(p.callArgs[0]);
    returnThisProperty(key ?? MAP_VALUES, p);
    if (key !== undefined)
        returnThisProperty(MAP_UNKNOWN_VALUES, p);
}

export function mapSet(p: NativeFunctionParams) {
    const prefix = spreadIndex(p.callArgs);
    const key = prefix > 0 ? keyProperty(p.callArgs[0]) : undefined;
    if (prefix > 0)
        assignParameterToThisProperty(0, MAP_KEYS, p);
    if (prefix > 1) {
        assignParameterToThisProperty(1, MAP_VALUES, p);
        assignParameterToThisProperty(1, key ?? MAP_UNKNOWN_VALUES, p);
    }
    // With --spread, arguments after the first spread have unknown positions.
    // Preserve all possible values rather than dropping an unknown write.
    if (prefix < 2 && p.tailVar && p.base) {
        for (const prop of [MAP_KEYS, MAP_VALUES, MAP_UNKNOWN_VALUES])
            p.solver.addSubsetConstraint(p.tailVar, p.solver.varProducer.objPropVar(p.base, prop));
    }
    returnThis(p); // supports Map.set(...).set(...) and aliases of its return
}
