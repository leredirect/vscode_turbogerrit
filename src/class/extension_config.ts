import * as vs from 'vscode';
import { API, GitExtension } from '../external/git';
import path from 'path';
import fs from 'fs';

export class ExtensionConfig {
    constructor() { }

    extensionKey: string = 'turbogerrit';

    private workspace = vs.workspace;
    private config: vs.WorkspaceConfiguration = this.workspace.getConfiguration(this.extensionKey);

    // reviewers config
    get reviewersAttribute() {
        const reviewers = this.getReviewers();
        return reviewers !== null ? `%r=${reviewers.join(',r=')}` : '';
    }
    private reviewersKey: string = 'reviewers';
    private getReviewers(): Array<string> | null {
        let reviwers = this.config.get<Array<string>>(this.reviewersKey);
        if (reviwers === undefined || reviwers.length === 0) return null;
        return reviwers;
    }

    // git config
    get currentBranch() {
        const head = this.head;
        if (head === null) return null;
        const name = head.name;
        if (name === undefined) return null;
        return name;
    }
    get hasCommits() {
        const head = this.head;
        if (head === null) return null;
        if (head.ahead === undefined) return null;
        return head.ahead;
    }
    private get head() {
        const config = this.getScmGitApiCore();
        if (config === null) return null;
        const repository = config.repositories[0];
        if (repository === undefined || repository === null) return null;
        const head = repository.state.HEAD;
        if (head === undefined) return null;
        return head;
    }
    private getScmGitApiCore(): API | null {
        const extension = vs.extensions.getExtension<GitExtension>('vscode.git');
        if (!extension || extension === null || !extension.isActive) return null;
        let api = extension.exports.getAPI(1);
        return api;
    }

    // cwd
    get cwd() {
        let workspaces = this.workspace.workspaceFolders;
        if (workspaces === undefined || workspaces.length === 0) return null;
        return workspaces[0].uri.path;
    }

    // username
    private usernameKey: string = 'username';
    async setUsername() {
        const usernameInput = await vs.window.showInputBox({
            title: "Gerrit Code Review email:"
        }) ?? null;
        await this.config.update(this.usernameKey, usernameInput, 1);
    }

    getUsername(): string | null {
        let reviwers = this.config.get<string>(this.usernameKey);
        if (reviwers === undefined || reviwers.length === 0) return null;
        return reviwers;
    }

    // gitreview file
    private gitreviewPathKey: string = 'gitreviewPath';
    async setGitReviewPath() {
        const gitReviewPaths = await vs.window.showOpenDialog({
            canSelectFolders: false,
            canSelectMany: false,
        });
    
        if (!gitReviewPaths || gitReviewPaths.length === 0) return;
    
        const gitReviewPath = gitReviewPaths[0].fsPath;
        await this.config.update(this.gitreviewPathKey, gitReviewPath);
    }
    private getGitReviewFileAsString() {
        const maybeCustomPath = this.config.get<string>(this.gitreviewPathKey);
    
        const gitReviewPath = (maybeCustomPath && maybeCustomPath !== '') 
            ? maybeCustomPath 
            : this.workspace.workspaceFolders?.map(folder =>
                path.join(folder.uri.fsPath, '.gitreview')
            ).find(fs.existsSync);
    
        return gitReviewPath ? fs.readFileSync(gitReviewPath, 'utf8') : null;
    }
    parseGitReviewFile(): { port: number; host: string; project: string } | null {
        const review = this.getGitReviewFileAsString();
        if (!review) return null;

        let port: number | undefined;
        let host: string | undefined;
        let project: string | undefined;

        for (const line of review.split('\n')) {
            const [key, value] = line.trim().split('=').map((part) => part.trim());
            if (!value) continue;
            switch (key) {
                case 'port':
                    port = parseInt(value, 10);
                    break;
                case 'host':
                    host = value;
                    break;
                case 'project':
                    project = value;
                    break;
            }
        }

        if (port && host && project) {
            return { port, host, project };
        }

        return null;
    }

}