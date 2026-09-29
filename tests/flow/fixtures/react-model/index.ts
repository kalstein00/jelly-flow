import React, {useCallback as alias} from 'react';
import * as ReactNS from 'react';
import {memoizeCallback} from './barrel';
import {useCallback as other} from '../not-react';
import {useCallback as unsupported} from '../unsupported-react';

export function savedAlias() { return 1; }
export function savedNamespace() { return 2; }
export function savedDefault() { return 3; }
export function savedReexport() { return 4; }
export function neverInvoked() { return 5; }
export function localIgnored() { return 6; }
export function otherIgnored() { return 7; }
export function unsupportedIgnored() { return 8; }
export function localResult() { return 9; }
function useCallback(fn: Function) { return localResult; }

export function useCustom() { return alias(savedAlias, []); }
export function callAlias() { return useCustom()(); }
export function callNamespace() { return ReactNS.useCallback(savedNamespace, [])(); }
export function callDefault() { return React.useCallback(savedDefault, [])(); }
export function callReexport() { return memoizeCallback(savedReexport, [])(); }
export function onlyRegister() { return alias(neverInvoked, []); }
export function callLocal() { return useCallback(localIgnored)(); }
export function callOther() { return other(otherIgnored)(); }
export function callUnsupported() { return unsupported(unsupportedIgnored)(); }
