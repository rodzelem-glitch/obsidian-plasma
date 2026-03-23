import { Project, SyntaxKind, Node } from "ts-morph";

const project = new Project({
    tsConfigFilePath: "./tsconfig.json",
});

project.addSourceFilesAtPaths("src/**/*.{tsx,ts}");

let modifiedCount = 0;

for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    if (filePath.includes("ConfirmContext.tsx") || filePath.includes("globalConfirm.ts")) {
        continue;
    }

    let modified = false;

    // Find all CallExpressions
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    
    // We have to iterate carefully because mutating nodes can break traversal. 
    // It's safer to map to an array and mutate bottom-up or just collect them
    const confirmNodes = [];
    for (const callExpr of callExpressions) {
        const text = callExpr.getExpression().getText();
        if (text === "confirm" || text === "window.confirm") {
            const parent = callExpr.getParent();
            // Don't modify if it's already awaited (e.g. we already refactored it with useConfirm)
            if (!Node.isAwaitExpression(parent)) {
                confirmNodes.push(callExpr);
            }
        }
    }

    if (confirmNodes.length > 0) {
        for (const callExpr of confirmNodes) {
            const args = callExpr.getArguments().map(arg => arg.getText());
            callExpr.replaceWithText(`await globalConfirm(${args.join(", ")})`);
            modified = true;
        }

        if (modified) {
            // Find all functions containing `await` that aren't async, and make them async
            const awaitExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.AwaitExpression);
            for (const awaitExpr of awaitExpressions) {
                const enclosingFunction = awaitExpr.getFirstAncestor(node => {
                    return Node.isArrowFunction(node) ||
                           Node.isFunctionDeclaration(node) ||
                           Node.isFunctionExpression(node) ||
                           Node.isMethodDeclaration(node);
                });

                if (enclosingFunction) {
                    // @ts-ignore
                    if (enclosingFunction.setIsAsync && !enclosingFunction.isAsync()) {
                        // @ts-ignore
                        enclosingFunction.setIsAsync(true);
                    }
                }
            }

            // Add import
            const existingImport = sourceFile.getImportDeclaration(decl => decl.getModuleSpecifierValue().includes("globalConfirm"));
            if (!existingImport) {
                sourceFile.addImportDeclaration({
                    namedImports: ["globalConfirm"],
                    moduleSpecifier: "lib/globalConfirm",
                });
            }
            
            console.log(`Updated ${filePath}`);
            modifiedCount++;
        }
    }
}

if (modifiedCount > 0) {
    project.saveSync();
    console.log(`Successfully refactored ${modifiedCount} files.`);
} else {
    console.log("No files needed refactoring.");
}
