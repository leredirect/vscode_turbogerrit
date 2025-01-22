import { GerritReviewFilter } from "../gerrit_review_filter";
import { GerritCommitData } from "../gerrit_commit_data";
import { GerritTreeItem } from "./gerrit_tree_item";
import * as vs from 'vscode';

export class GerritReviewItem extends GerritTreeItem {
    constructor(
        public readonly data: GerritCommitData,
        public readonly subject?: string,
    ) {
        super(`${subject}`, vs.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'review';
        this.tooltip = `${data.commitMsg}`;
    }
}

export class GerritSectionItem extends GerritTreeItem {

    constructor(
        public children: GerritTreeItem[] = [],
        filter: GerritReviewFilter,
    ) {
        super(filter === GerritReviewFilter.incoming ? `Incoming reviews` : 'Outgoing reviews', vs.TreeItemCollapsibleState.Collapsed);
    }
}