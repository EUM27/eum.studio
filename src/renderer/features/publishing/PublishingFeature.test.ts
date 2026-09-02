import { readFileSync } from "node:fs";

import * as ts from "typescript";
import { describe, expect, it } from "vitest";

function readSource(
  relativePath: string,
  scriptKind: ts.ScriptKind,
): Readonly<{ source: string; sourceFile: ts.SourceFile }> {
  const source = readFileSync(
    new URL(relativePath, import.meta.url),
    "utf8",
  ).replace(/\r\n?/gu, "\n");
  return Object.freeze({
    source,
    sourceFile: ts.createSourceFile(
      relativePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    ),
  });
}

function collectNodes<T extends ts.Node>(
  sourceFile: ts.SourceFile,
  matches: (node: ts.Node) => node is T,
): readonly T[] {
  const result: T[] = [];
  const visit = (node: ts.Node): void => {
    if (matches(node)) result.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return Object.freeze(result);
}

function namedJsxElements(
  sourceFile: ts.SourceFile,
  name: string,
): readonly ts.JsxSelfClosingElement[] {
  return collectNodes(
    sourceFile,
    (node): node is ts.JsxSelfClosingElement =>
      ts.isJsxSelfClosingElement(node) &&
      node.tagName.getText(sourceFile) === name,
  );
}

describe("PublishingFeature", () => {
  it("keeps the complete live PublishingPartnerDialog prop surface", () => {
    const feature = readSource("./PublishingFeature.tsx", ts.ScriptKind.TSX);
    const dialog = readSource(
      "../../publishing/PublishingPartnerDialog.tsx",
      ts.ScriptKind.TSX,
    );
    const dialogElements = namedJsxElements(
      feature.sourceFile,
      "PublishingPartnerDialog",
    );
    expect(dialogElements).toHaveLength(1);
    const dialogElement = dialogElements[0];
    if (dialogElement === undefined) throw new Error("Missing dialog host");

    const liveAttributeNames = dialogElement.attributes.properties.map(
      (attribute) => {
        if (!ts.isJsxAttribute(attribute)) {
          throw new Error("PublishingPartnerDialog cannot use spread props");
        }
        return attribute.name.getText(feature.sourceFile);
      },
    );
    const dialogFunctions = collectNodes(
      dialog.sourceFile,
      (node): node is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(node) &&
        node.name?.text === "PublishingPartnerDialog",
    );
    expect(dialogFunctions).toHaveLength(1);
    const dialogFunction = dialogFunctions[0];
    const parameterType = dialogFunction?.parameters[0]?.type;
    if (parameterType === undefined || !ts.isTypeLiteralNode(parameterType)) {
      throw new Error("Missing inline PublishingPartnerDialog prop type");
    }
    const declaredPropertyNames = parameterType.members.map((member) => {
      if (member.name === undefined) {
        throw new Error("PublishingPartnerDialog prop must be named");
      }
      return member.name.getText(dialog.sourceFile);
    });

    expect(liveAttributeNames).toHaveLength(66);
    expect(declaredPropertyNames).toHaveLength(66);
    expect([...liveAttributeNames].sort()).toEqual(
      [...declaredPropertyNames].sort(),
    );
    expect(feature.source).not.toMatch(/\busePublishingController\s*\(/gu);
    expect(feature.source).toContain(
      "if (!controller.showPublishingPartners || catalog === null)",
    );
    expect(feature.source).toContain(
      "controller.publishingWorkScopeId === null",
    );
    expect(feature.source).toContain(
      "(work) => work.workId === controller.publishingWorkScopeId",
    );
  });

  it("keeps one unconditional controller in Shell and one stateless host", () => {
    const shell = readSource("../../StudioShell.tsx", ts.ScriptKind.TSX);
    const hookCalls = collectNodes(
      shell.sourceFile,
      (node): node is ts.CallExpression =>
        ts.isCallExpression(node) &&
        node.expression.getText(shell.sourceFile) === "usePublishingController",
    );
    expect(hookCalls).toHaveLength(1);
    const hookCall = hookCalls[0];
    if (hookCall === undefined) throw new Error("Missing controller hook call");
    expect(hookCall.arguments.map((argument) => argument.getText(shell.sourceFile)))
      .toEqual(["window.eumStudio"]);
    const declaration = hookCall.parent;
    expect(ts.isVariableDeclaration(declaration)).toBe(true);
    if (!ts.isVariableDeclaration(declaration)) {
      throw new Error("Controller hook must remain a variable declaration");
    }
    expect(ts.isIdentifier(declaration.name)).toBe(true);
    expect(declaration.name.getText(shell.sourceFile)).toBe(
      "publishingController",
    );

    const featureElements = namedJsxElements(
      shell.sourceFile,
      "PublishingFeature",
    );
    expect(featureElements).toHaveLength(1);
    const featureElement = featureElements[0];
    if (featureElement === undefined) throw new Error("Missing feature host");
    expect(hookCall.getStart(shell.sourceFile)).toBeLessThan(
      featureElement.getStart(shell.sourceFile),
    );
    expect(
      featureElement.attributes.properties.map((attribute) => {
        if (!ts.isJsxAttribute(attribute)) {
          throw new Error("PublishingFeature cannot use spread props");
        }
        return attribute.name.getText(shell.sourceFile);
      }),
    ).toEqual(["catalog", "controller"]);

    let ancestor: ts.Node | undefined = featureElement.parent;
    while (ancestor !== undefined && !ts.isReturnStatement(ancestor)) {
      expect(ts.isConditionalExpression(ancestor)).toBe(false);
      expect(ts.isBinaryExpression(ancestor)).toBe(false);
      ancestor = ancestor.parent;
    }

    expect(namedJsxElements(shell.sourceFile, "PublishingPartnerDialog"))
      .toHaveLength(0);
    expect(shell.source).not.toContain(
      './publishing/PublishingPartnerDialog',
    );
    expect(
      shell.source.match(
        /onOpenPublishing=\{publishingController\.openPublishingPartners\}/gu,
      ),
    ).toHaveLength(2);
  });
});
