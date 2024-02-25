import { getInput, setFailed } from "@actions/core";
import { context, getOctokit } from "@actions/github";

async function run() {
  const token = getInput("gh-token");
  const octokit = getOctokit(token);

  try {
    switch (context.eventName) {
      case "pull_request":
        addLabel(octokit);
        assignReviewer(octokit);
        break;
      case "pull_request_review":
        switch (context.payload.action) {
          case "submitted":
          case "edited":
          case "dismissed":
            assignReviewer(octokit);
            break;
          default:
            break;
        }
        break;
      case "pull_request_target":
        switch (context.payload.action) {
          case "synchronize":
            addLabel(octokit);
            assignReviewer(octokit);
            break;
          case "converted_to_draft":
          case "ready_for_review":
          case "review_requested":
            assignReviewer(octokit);
            break;
          default:
            break;
        }
        break;
      default:
        setFailed("This action can only be run on pull_request events");
        return;
    }
  } catch (error) {
    setFailed((error as Error)?.message ?? "Unknown error occurred");
  }
}

async function addLabel(octokit: ReturnType<typeof getOctokit>) {
  const pullRequest = context.payload.pull_request;
  if (!pullRequest) {
    throw new Error("This action can only be run on pull_request events");
  }

  const files = await octokit.rest.pulls.listFiles({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: pullRequest.number,
  });

  if (files.data.some((file) => file.filename.endsWith(".md"))) {
    // update labels of pull request
    await octokit.rest.issues.setLabels({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: pullRequest.number,
      labels: ["documentation"],
    });
  }
}

async function assignReviewer(octokit: ReturnType<typeof getOctokit>) {
  const pullRequest = context.payload.pull_request;
  if (!pullRequest) {
    throw new Error("This action can only be run on pull_request events");
  }

  if (pullRequest.draft) {
    await octokit.rest.issues.update({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: pullRequest.number,
      assignees: [pullRequest.user.login],
    });
    return;
  }

  // list of reviewers from pull request
  const { data: reviews } = await octokit.rest.pulls.listReviews({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: pullRequest.number,
  });

  let assignee = null;
  const changesRequestedReview = reviews.find(
    (review) => review.state === "CHANGES_REQUESTED",
  );
  if (changesRequestedReview) {
    assignee = pullRequest.user.login;
    return;
  }

  const pendingReview = reviews.find((review) => review.state === "PENDING");
  if (pendingReview) {
    assignee = pendingReview?.user?.login;
    return;
  }

  const approvedReviews = reviews.filter(
    (review) => review.state === "APPROVED",
  );

  if (approvedReviews.length >= 2) {
    assignee = null;
  }

  // add assignee to pull request
  await octokit.rest.issues.update({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: pullRequest.number,
    assignees: assignee == null ? [] : [assignee],
  });
}

run();
