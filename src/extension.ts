import * as vs from 'vscode';
import cp from 'child_process';
import { API, GitExtension } from './external/git';
import { Log } from './class/log';

const log = new Log();
export async function activate(context: vs.ExtensionContext) {
	await registerCommands(context);
}

export function deactivate() { }

async function registerCommands(context: vs.ExtensionContext) {
	const pushToGerritCommand =
		vs.commands.registerCommand('turbogerrit.pushToGerrit', pushToGerrit);

	context.subscriptions.push(pushToGerritCommand);
}

async function pushToGerrit() {
	let window = vs.window;
	log.i('Waiting for git API...');
	const git: API | null | undefined = await getScmGitApiCore();
	if (git === undefined || git === null) {
		log.vsE('Git API is unavailable yet, try later.');
	}
	log.i('Git API recieved, unpacking repo...');
	if (git!.repositories.length > 1) {
		log.vsE('Git instace of current workspace contains more than one repository.');
		return;
	}
	const repo = git!.repositories[0];
	const hasCommits = repo.state?.HEAD?.ahead !== 0;
	if (!hasCommits) {
		log.vsE('Nothing to push! Hack some commit before calling this command.');
		return;
	}

	const currentBranchName = repo?.state?.HEAD?.name;
	if (currentBranchName === undefined || currentBranchName.length === null) {
		log.vsE(`Current branch name seems incorrect: ${currentBranchName}`);
		return;
	}

	log.i('Fetching config...');
	let config = vs.workspace.getConfiguration('turbogerrit');
	let reviwers = config.get<Array<string>>('turbogerrit.revievers');
	let hasReviewers = reviwers === undefined || reviwers.length === 0;

	log.i('Creating process...');
	let workspaces = vs.workspace.workspaceFolders;
	if (workspaces === undefined || workspaces.length === 0) {
		log.vsE(`Can't fetch current working directory, try to run "git review ${currentBranchName} --yes" in terminal`);
		return;
	}
	let cd = workspaces[0].uri.path;


	cp.exec(`cd ${cd} && git review ${currentBranchName} --yes --reviewers ${hasReviewers ? reviwers?.join(' ') : ''}`,
		// mock command // cp.exec(`cd ${cd} && hehe -a`,
		(err, stdout, stderr) => {
			log.e(`STDERR: ${stderr}`);
			log.e(`STDOUT: ${stdout}`);
			log.e(`ERR: ${err?.message}`);
			log.e(`ERR CODE: ${err?.code}`);
			let exitCode = err?.code;
			switch (exitCode) {
				case null:
				case 0:
					log.vsI('Sucsessfully pushed to refs/for/${currentBranchName}');
					return;
				case 1:
					log.vsE('Something went wrong, see Output > TurboGerrit for more info...');
					log.e(`STDOUT: ${stdout}`);
					log.e(`ERR: ${err?.message}`);
					log.e(`ERR CODE: ${err?.code}`);
					log.e(`STDERR: ${stderr}`);
					return;
				case 127:
				case 9009:
					log.e('got 127 or 9009, means "git review" is not installed, asking for install...');
					vs.window.showInformationMessage(
						'git review is not installed, do you want to install it?',
						'Install using Brew',
						'Install using Pip',
					).then((selected) => {
						switch (selected) {
							case "Install using Brew":
								installGitReviewUsingBrew(cd);
								return;
							case "Install using Pip":
								installGitReviewUsingPy(cd);
								return;
						}
					});
			}
		},
	);

}

async function installGitReviewUsingBrew(cd: string) {
	cp.exec(`cd ${cd} && brew install git-review`, (err, stdout, stderr) => {
		let exitCode = err?.code;
		switch (exitCode) {
			case null:
			case 0:
				log.vsI('git review successfully installed, you can try to push again :)');
				return;
			case 127:
			case 9009:
				vs.window.showErrorMessage('"brew" is not installed', 'Visit git-review website').then(() => {
					vs.env.openExternal(vs.Uri.parse('https://docs.opendev.org/opendev/git-review/latest/installation.html'));
				});
			default:
				log.vsE('Error: try to run "brew install git-review" in terminal. See Output > TurboGerrit for detailed info.');
				log.e(`STDOUT: ${stdout}`);
				log.e(`ERR: ${err?.message}`);
				log.e(`ERR CODE: ${err?.code}`);
				log.e(`STDERR: ${stderr}`);
		}
	});
}

async function installGitReviewUsingPy(cd: string) {
	cp.exec(`cd ${cd} && pip install git-review`, (err, stdout, stderr) => {
		let exitCode = err?.code;
		switch (exitCode) {
			case null:
			case 0:
				log.vsI('git review successfully installed, you can try to push again :)');
				return;
			case 127:
			case 9009:
				vs.window.showErrorMessage('"pip" is not installed', 'Visit git-review website').then(() => {
					vs.env.openExternal(vs.Uri.parse('https://docs.opendev.org/opendev/git-review/latest/installation.html'));
				});
			default:
				log.vsE('Error: try to run "py install git-review" in terminal. See Output > TurboGerrit for detailed info.');
				log.e(`STDOUT: ${stdout}`);
				log.e(`ERR: ${err?.message}`);
				log.e(`ERR CODE: ${err?.code}`);
				log.e(`STDERR: ${stderr}`);
		}
	});
}

async function getScmGitApiCore() {
	const extension = vs.extensions.getExtension<GitExtension>('vscode.git');
	if (!extension || extension === null) return null;
	const gitExtension = extension.isActive ? extension.exports : await extension.activate();
	let api = gitExtension?.getAPI(1);
	return api;
}

exports = {
	activate,
	deactivate,
};
