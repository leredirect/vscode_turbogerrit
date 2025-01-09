import * as vs from 'vscode';
import cp from 'child_process';
import { Log } from './class/log';
import { ExtensionConfig } from './class/extension_config';

const log = new Log();
export async function activate(context: vs.ExtensionContext) {
	await registerCommands(context);
}

export function deactivate() { }

async function registerCommands(context: vs.ExtensionContext) {
	const pushToGerritCommand =
		vs.commands.registerCommand('turbogerrit.pushToGerrit', pushToGerrit);
	const initialSetupCommand =
		vs.commands.registerCommand('turbogerrit.initialSetup', initialSetup);

	context.subscriptions.push(pushToGerritCommand);
	context.subscriptions.push(initialSetupCommand);
}

async function initialSetup() {
	const config = new ExtensionConfig();
	await config.setUsername();
}

async function pushToGerrit() {
	let config: ExtensionConfig = new ExtensionConfig();
	const gitReview = config.parseGitReviewFile();
	const username = config.getUsername();
	const hasCommits = config.hasCommits;
	const currentBranch = config.currentBranch;
	const cwd = config.cwd;
	if (username === null) {
		vs.window.showInformationMessage('TurboGerrit: I dont know your username. Do you want to set username in settings?',
			'Sure').then(async (selected) => {
				if (selected === undefined) return;
				await config.setUsername();
				return;
			});
		return;
	}
	if (gitReview === null) {
		vs.window.showInformationMessage('TurboGerrit: I cant find your .gitreview file. Do you want to set path in settings?',
			'Sure').then(async (selected) => {
				if (selected === undefined) return;
				await config.setGitReviewPath();
				return;
			});
		return;
	}
	if (cwd === null || currentBranch === null) {
		log.vsE("Open workspace, or wait until it's initialization.");
		return;
	}
	if (hasCommits === null) {
		log.vsE('Nothing to commit. Hack some code, then call this command again.');
		return;
	}

	const command = `cd ${cwd} && git push ssh://${username}@${gitReview.host}:${gitReview.port}/${gitReview.project} HEAD:refs/for/${currentBranch}${config.reviewersAttribute}`;
	log.i('Executing:');
	log.i(command);
	await vs.window.withProgress({
		location: vs.ProgressLocation.Notification,
		title: `Pushing to refs/for/${currentBranch}`,
	}, () => {
		return new Promise<void>(async resolve => {
			cp.exec(command,
				(err, stdout, stderr) => {
					onPushExecuted(err, stdout, stderr, currentBranch);
					resolve();
				});
		});
	});

}

function onPushExecuted(err: cp.ExecException | null, stdout: string, stderr: string, currentBranch: string) {
	log.logCpContent(err, stdout, stderr);
	let exitCode = err?.code;
	if (stderr?.includes('Could not resolve hostname')) {
		log.vsE('Could not connect to Gerrit. Maybe you forgot to turn on the VPN?');
		return;
	}
	if (stderr?.includes('no new changes')) {
		log.vsE('Rejected from remote, nothing to push.');
		return;
	}
	if (exitCode === undefined) { 
		log.vsI(`Sucsessfully pushed to refs/for/${currentBranch}`);
		return;
	}
	switch (exitCode) {
		case 1:
		case 2:
			log.vsE('Something went wrong, see Output > TurboGerrit for more info...');
			return;
		case 127:
		case 9009:
			log.vsE('"ssh" is not installed');
			return;
	}
}

exports = {
	activate,
	deactivate,
};
