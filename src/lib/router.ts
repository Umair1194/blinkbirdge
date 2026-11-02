import { useEffect, useState } from 'react'

export type Route =
  | 'welcome'
  | 'setup'
  | 'calibrate'
  | 'workspace'
  | 'phrases'
  | 'history'
  | 'settings'
  | 'keyboard'
  | 'help'

const ROUTES: Route[] = ['welcome', 'setup', 'calibrate', 'workspace', 'phrases', 'history', 'settings', 'keyboard', 'help']

function parse(fallback: Route): Route {
  const r = window.location.hash.replace(/^#\/?/, '') as Route
  return ROUTES.includes(r) ? r : fallback
}

export function navigate(route: Route) {
  window.location.hash = `/${route}`
}

export function useRoute(fallback: Route) {
  const [route, setRoute] = useState<Route>(() => parse(fallback))
  useEffect(() => {
    const onHash = () => setRoute(parse(fallback))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [fallback])
  return route
}
