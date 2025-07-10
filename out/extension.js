"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
function activate(context) {
    console.log('RenPy Image Preview está activo');
    const provider = new RenPyImageHoverProvider();
    const hoverDisposable = vscode.languages.registerHoverProvider({ language: 'renpy', scheme: 'file' }, provider);
    // Comando: Abrir imagen con visor del sistema
    const openImageCommand = vscode.commands.registerCommand('renpyImagePreview.openInDefaultViewer', (uriString) => {
        const uri = vscode.Uri.parse(uriString);
        vscode.env.openExternal(uri);
    });
    // Comando: Abrir ubicación en explorador de archivos
    const revealInExplorerCommand = vscode.commands.registerCommand('renpyImagePreview.revealInExplorer', (uriString) => {
        const uri = vscode.Uri.parse(uriString);
        vscode.commands.executeCommand('revealFileInOS', uri);
    });
    context.subscriptions.push(hoverDisposable, openImageCommand, revealInExplorerCommand);
}
exports.activate = activate;
class RenPyImageHoverProvider {
    constructor() {
        this.imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
    }
    async provideHover(document, position, token) {
        const line = document.lineAt(position);
        const lineText = line.text;
        const sceneMatch = this.findScenePattern(lineText, position.character);
        if (!sceneMatch) {
            return undefined;
        }
        const imageName = sceneMatch.imageName;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            return undefined;
        }
        const imagePath = await this.findImageInProject(workspaceFolder.uri.fsPath, imageName);
        if (!imagePath) {
            return new vscode.Hover(new vscode.MarkdownString(`🖼️ **Imagen no encontrada**: \`${imageName}\``));
        }
        const imageUri = vscode.Uri.file(imagePath);
        const relativePath = path.relative(workspaceFolder.uri.fsPath, imagePath);
        const encodedUri = encodeURIComponent(JSON.stringify(imageUri.toString()));
        const markdown = new vscode.MarkdownString();
        markdown.isTrusted = true;
        // Imagen (clicable para abrir con visor del sistema)
        markdown.appendMarkdown(`[![${imageName}](${imageUri}|width=300)](command:renpyImagePreview.openInDefaultViewer?${encodedUri})\n\n`);
        // Ruta (clicable para abrir el explorador de archivos)
        markdown.appendMarkdown(`**Ubicación**: [\`${relativePath}\`](command:renpyImagePreview.revealInExplorer?${encodedUri})\n\n`);
        markdown.appendMarkdown(`**Tamaño**: ${this.getFileSize(imagePath)}`);
        return new vscode.Hover(markdown);
    }
    findScenePattern(lineText, characterPosition) {
        const patterns = [
            /scene\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
            /show\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
            /hide\s+([a-zA-Z_][a-zA-Z0-9_]*)/g
        ];
        for (const pattern of patterns) {
            let match;
            pattern.lastIndex = 0;
            while ((match = pattern.exec(lineText)) !== null) {
                const start = match.index + match[0].indexOf(match[1]);
                const end = start + match[1].length;
                if (characterPosition >= start && characterPosition <= end) {
                    return {
                        imageName: match[1],
                        start,
                        end
                    };
                }
            }
        }
        return undefined;
    }
    async findImageInProject(workspacePath, imageName) {
        const searchPaths = [
            path.join(workspacePath, 'images'),
            path.join(workspacePath, 'game', 'images'),
            path.join(workspacePath, 'game'),
            workspacePath
        ];
        for (const searchPath of searchPaths) {
            const foundPath = await this.searchInDirectory(searchPath, imageName);
            if (foundPath) {
                return foundPath;
            }
        }
        return undefined;
    }
    async searchInDirectory(dirPath, imageName) {
        if (!fs.existsSync(dirPath)) {
            return undefined;
        }
        try {
            const files = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const file of files) {
                if (file.isFile()) {
                    const fileName = path.parse(file.name).name;
                    const fileExt = path.parse(file.name).ext.toLowerCase();
                    if (fileName === imageName && this.imageExtensions.includes(fileExt)) {
                        return path.join(dirPath, file.name);
                    }
                }
            }
            for (const file of files) {
                if (file.isDirectory()) {
                    const subDirPath = path.join(dirPath, file.name);
                    const found = await this.searchInDirectory(subDirPath, imageName);
                    if (found) {
                        return found;
                    }
                }
            }
        }
        catch (error) {
            console.error('Error buscando en directorio:', error);
        }
        return undefined;
    }
    getFileSize(filePath) {
        try {
            const stats = fs.statSync(filePath);
            const bytes = stats.size;
            if (bytes === 0)
                return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
        catch (error) {
            return 'Desconocido';
        }
    }
}
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map