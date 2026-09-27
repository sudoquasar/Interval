import { Link, useLocation } from 'react-router';
import { useDocumentTitle } from '../lib/hooks';
import { buttonClass } from '../ui/Button';
import { Notice } from '../ui/Notice';

export function NotFound() {
  const { pathname } = useLocation();
  useDocumentTitle('Not found');
  return (
    <div className="px-4 sm:px-8">
      <Notice
        title={`Nothing lives at ${pathname}.`}
        action={
          <Link to="/" className={buttonClass('secondary')}>
            Go to the home page
          </Link>
        }
      >
        Search for the title instead, or start from the home page.
      </Notice>
    </div>
  );
}
