import { redirect } from 'next/navigation';

export default function SearchPage() {
  // Redirect to the unified search page (Events page with merged search functionality)
  redirect('/events');
}
