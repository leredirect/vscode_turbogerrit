import * as path from 'path';
import * as vs from 'vscode';
import { GerritTreeItem } from './gerrit_tree_item';


export class GerritFileItem extends GerritTreeItem {
    constructor(
        public readonly fileName: string,
        public readonly revision: string,
        public readonly modification: string,
        public readonly fileExt: string
    ) {
        super(fileName, vs.TreeItemCollapsibleState.None);
        const iconLight = (() => {
            switch (modification) {
                case 'MM':
                case 'M': return 'm.svg';
                case 'A': return 'a.svg';
                case 'D': return 'd.svg';
                case 'R': return 'r.svg';
                default: return 'unknown.svg';
            }
        })();
        const iconDark = (() => {
            switch (modification) {
                case 'MM':
                case 'M': return 'm_dark.svg';
                case 'A': return 'a_dark.svg';
                case 'D': return 'd_dark.svg';
                case 'R': return 'r_dark.svg';
                default: return 'unknown_dark.svg';
            }
        })();
        this.iconPath = {
            light: vs.Uri.file(path.join(__dirname, '..', '..', '..', 'resources', iconLight)),
            dark: vs.Uri.file(path.join(__dirname, '..', '..', '..', 'resources', iconDark)),
        };
        this.tooltip = `${fileName}`;
        this.contextValue = 'diff';
    }
}
