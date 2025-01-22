import * as vs from 'vscode';
import { GerritTreeItem } from './gerrit_tree_item';
import { GerritReviewFilter } from '../gerrit_review_filter';


export class GerritEmptyItem extends GerritTreeItem {
    constructor(
        gerritReviewFilter: GerritReviewFilter,
    ) {
        super(gerritReviewFilter === GerritReviewFilter.incoming ? 'No reviews assigned to you' : 'No outgoing reviews', vs.TreeItemCollapsibleState.None);
    }
}
