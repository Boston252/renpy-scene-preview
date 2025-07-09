import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    console.log('RenPy Image Preview está activo');

    // Registrar el proveedor de hover para archivos .rpy
    const provider = new RenPyImageHoverProvider();
    const disposable = vscode.languages.registerHoverProvider(
        { language: 'renpy', scheme: 'file' },
        provider
    );

    context.subscriptions.push(disposable);
}

class RenPyImageHoverProvider implements vscode.HoverProvider {
    private imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
    private imageCache = new Map<string, string>();

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | undefined> {
        const line = document.lineAt(position);
        const lineText = line.text;

        // Buscar patrones de scene en RenPy
        const sceneMatch = this.findScenePattern(lineText, position.character);
        if (!sceneMatch) {
            return undefined;
        }

        const imageName = sceneMatch.imageName;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        
        if (!workspaceFolder) {
            return undefined;
        }

        // Buscar la imagen en el proyecto
        const imagePath = await this.findImageInProject(
            workspaceFolder.uri.fsPath,
            imageName
        );

        if (!imagePath) {
            return new vscode.Hover(
                new vscode.MarkdownString(`🖼️ **Imagen no encontrada**: \`${imageName}\``)
            );
        }

        // Crear el hover con la imagen
        const imageUri = vscode.Uri.file(imagePath);
        const relativePath = path.relative(workspaceFolder.uri.fsPath, imagePath);
        
        const markdown = new vscode.MarkdownString();
        markdown.isTrusted = true;
        markdown.appendMarkdown(`![${imageName}](${imageUri}|width=300)\n\n`);
        markdown.appendMarkdown(`**Archivo**: \`${relativePath}\`\n\n`);
        markdown.appendMarkdown(`**Tamaño**: ${this.getFileSize(imagePath)}`);

        return new vscode.Hover(markdown);
    }

    private findScenePattern(lineText: string, characterPosition: number): 
        { imageName: string; start: number; end: number } | undefined {
        
        // Patrones comunes de RenPy para scenes
        const patterns = [
            /scene\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
            /show\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
            /hide\s+([a-zA-Z_][a-zA-Z0-9_]*)/g
        ];

        for (const pattern of patterns) {
            let match;
            pattern.lastIndex = 0; // Reset regex
            
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

    private async findImageInProject(
        workspacePath: string,
        imageName: string
    ): Promise<string | undefined> {
        // Buscar en directorios comunes de RenPy
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

    private async searchInDirectory(
        dirPath: string,
        imageName: string
    ): Promise<string | undefined> {
        if (!fs.existsSync(dirPath)) {
            return undefined;
        }

        try {
            const files = fs.readdirSync(dirPath, { withFileTypes: true });
            
            // Buscar archivos que coincidan con el nombre
            for (const file of files) {
                if (file.isFile()) {
                    const fileName = path.parse(file.name).name;
                    const fileExt = path.parse(file.name).ext.toLowerCase();
                    
                    if (fileName === imageName && this.imageExtensions.includes(fileExt)) {
                        return path.join(dirPath, file.name);
                    }
                }
            }

            // Buscar recursivamente en subdirectorios
            for (const file of files) {
                if (file.isDirectory()) {
                    const subDirPath = path.join(dirPath, file.name);
                    const found = await this.searchInDirectory(subDirPath, imageName);
                    if (found) {
                        return found;
                    }
                }
            }
        } catch (error) {
            console.error('Error buscando en directorio:', error);
        }

        return undefined;
    }

    private getFileSize(filePath: string): string {
        try {
            const stats = fs.statSync(filePath);
            const bytes = stats.size;
            
            if (bytes === 0) return '0 Bytes';
            
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        } catch (error) {
            return 'Desconocido';
        }
    }
}

export function deactivate() {}