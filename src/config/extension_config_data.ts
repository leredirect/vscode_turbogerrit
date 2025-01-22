import { Repository } from "../external/git";

export interface ExtensionConfigData {
    username: string;
    hasCommits: boolean;
    currentBranch: string;
    cwd: string;
    gitReview: {
        port: number;
        host: string;
        project: string;
    };
    email: string;
    reviewersAttribute: string;
    repository: Repository;
}

