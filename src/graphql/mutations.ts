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
