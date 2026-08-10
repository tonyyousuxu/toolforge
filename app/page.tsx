import { Suspense } from "react";
import HomePageBody from "./home-page-body";

/**
 * Root page. Suspense boundary is REQUIRED here so that
 * HomePageBody (which uses useSearchParams()) can be
 * statically pre-rendered by Next.js 14 App Router.
 *
 * See: https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
 */
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageBody />
    </Suspense>
  );
}
