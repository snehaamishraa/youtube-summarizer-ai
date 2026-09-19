import { gql } from '@apollo/client';
/**
 * Insert a new summary into the database.
 * The user_id is automatically set by Hasura via the x-hasura-user-id column preset.
 */
export const INSERT_SUMMARY = gql`
  mutation InsertSummary(
    $videoId: String!
    $videoUrl: String!
    $videoTitle: String!
    $channelTitle: String!
    $thumbnailUrl: String!
    $duration: Int!
    $summary: String!
    $transcript: String
  ) {
    insertSummary(
      object: {
        videoId: $videoId
        videoUrl: $videoUrl
        videoTitle: $videoTitle
        channelTitle: $channelTitle
        thumbnailUrl: $thumbnailUrl
        duration: $duration
        summary: $summary
        transcript: $transcript
      }
    ) {
      id
      videoId
      videoUrl
      videoTitle
      channelTitle
      thumbnailUrl
      duration
      summary
      transcript
      createdAt
    }
  }
`;

/**
 * Delete a summary by its primary key (id).
 * Hasura RLS ensures users can only delete their own summaries.
 */
export const DELETE_SUMMARY = gql`
  mutation DeleteSummary($id: uuid!) {
    deleteSummary(id: $id) {
      id
    }
  }
`;

/**
 * Step 1: get a YouTube video's title, channel and transcript via Hasura Action.
 */
export const FETCH_TRANSCRIPT = gql`
  mutation FetchTranscript($url: String!) {
    fetchTranscript(url: $url) {
      videoId
      videoTitle
      channelTitle
      duration
      transcript
    }
  }
`;

/**
 * Step 2: summarize the transcript from step 1 and save it, via Hasura Action.
 */
export const SUMMARIZE_VIDEO = gql`
  mutation SummarizeVideo(
    $url: String!
    $videoId: String!
    $videoTitle: String!
    $channelTitle: String!
    $duration: Int!
    $transcript: String!
  ) {
    summarizeVideo(
      url: $url
      videoId: $videoId
      videoTitle: $videoTitle
      channelTitle: $channelTitle
      duration: $duration
      transcript: $transcript
    ) {
      id
      videoTitle
      channelTitle
      thumbnailUrl
      duration
      summary
      modelUsed
    }
  }
`;

