import { useNavigate } from 'react-router';
import { createConversation } from '../utils/api.ts';

// The unit isn't known until the lease is read, so a lease review starts without one
export function useStartLeaseReview(): () => Promise<void> {
  const navigate = useNavigate();
  return async () => {
    const conversation = await createConversation('lease');
    navigate(`/c/${conversation.id}`);
  };
}
