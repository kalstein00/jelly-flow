import React, {useCallback, useMemo} from "react";
import {unmodeled} from "./barrel";
const {useCallback: cjs} = require("react");
const {useCallback: destructured} = React;
export function callback() {}
export function registerOnly() { return useCallback(callback, []); }
export function callCjs() { return cjs(callback, [])(); }
export function callDestructured() { return destructured(callback, [])(); }
export function unknownNamed() { return useMemo(() => callback, []); }
export function unknownNamespace() { return React.useMemo(() => callback, []); }
export function unknownReexport() { return unmodeled(() => callback, []); }
