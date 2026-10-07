import ts from "typescript";
import path from "path";
import {ReportInput} from "./report";

/** Imports are source evidence, not may-call edges. Unresolved targets remain visible evidence. */
export function collectImports(root: string, inventory: ReportInput["inventory"]): NonNullable<ReportInput["imports"]> {
    const evidence: NonNullable<ReportInput["imports"]> = [];
    const owned = new Set(inventory.map(f => f.path));
    for (const file of inventory) {
        const absolute = path.resolve(root, file.path), text = ts.sys.readFile(absolute);
        if (text === undefined) throw new Error("Cannot read import source: " + file.path);
        const source = ts.createSourceFile(absolute, text, ts.ScriptTarget.Latest, true);
        const configPath = ts.findConfigFile(path.dirname(absolute), ts.sys.fileExists);
        let options: ts.CompilerOptions = {allowJs: true, moduleResolution: ts.ModuleResolutionKind.Node10};
        if (configPath) {
            const config = ts.readConfigFile(configPath, ts.sys.readFile);
            if (!config.error) options = {...options, ...ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath)).options};
        }
        const add = (node: ts.Node, specifier: string, typeOnly: boolean) => {
            const resolved = ts.resolveModuleName(specifier, absolute, options, ts.sys).resolvedModule;
            const target = resolved && path.relative(root, resolved.resolvedFileName).replaceAll("\\", "/");
            const pos = source.getLineAndCharacterOfPosition(node.getStart(source));
            evidence.push({source: file.path, target: target && owned.has(target) ? target : undefined,
                specifier, typeOnly, location: file.path + ":" + (pos.line + 1) + ":" + (pos.character + 1)});
        };
        const visit = (node: ts.Node) => {
            if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
                const clause = node.importClause, bindings = clause?.namedBindings;
                const onlyTypes = !!clause?.isTypeOnly || (!!clause && !clause.name && !!bindings &&
                    ts.isNamedImports(bindings) && bindings.elements.length > 0 && bindings.elements.every(e => e.isTypeOnly));
                add(node, node.moduleSpecifier.text, onlyTypes);
            } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier))
                add(node, node.moduleSpecifier.text, node.isTypeOnly || (!!node.exportClause &&
                    ts.isNamedExports(node.exportClause) && node.exportClause.elements.length > 0 && node.exportClause.elements.every(e => e.isTypeOnly)));
            else if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]) &&
                (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
                    (ts.isIdentifier(node.expression) && node.expression.text === "require")))
                add(node, node.arguments[0].text, false);
            ts.forEachChild(node, visit);
        };
        visit(source);
    }
    return evidence;
}
