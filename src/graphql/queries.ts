import { gql } from '@apollo/client';

/**
 * Fetch all summaries for the currently authenticated user.
 * Results are ordered by creation date (newest first).
 */
export const GET_SUMMARIES = gql`
  query GetSummaries {
    summaries(order_by: { createdAt: desc }) {
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
 * Fetch a single summary by its primary key (id).
 */
export const GET_SUMMARY_BY_ID = gql`
  query GetSummaryById($id: uuid!) {
    summary(id: $id) {
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
