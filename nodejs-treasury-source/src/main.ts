import './index.css';
import { chapters, findChapter } from './data';
import type { Route } from './lib/router';
import { initRouter } from './lib/router';
import { createLayout } from './ui/layout';
import { initSearch } from './ui/search';
import { renderSidebar } from './ui/sidebar';
import { renderChapter } from './ui/content';
import { renderHome } from './ui/home';
import { bindCodeBlockActions } from './ui/codeblock';

const app = document.getElementById('app') as HTMLElement;
const layout = createLayout(app);

initSearch(layout.searchWrap, layout.searchInput, layout.searchDropdown, chapters);
bindCodeBlockActions(layout.main);

function onRouteChange(route: Route): void {
  if (route.name === 'chapter') {
    const chapter = findChapter(route.chapterId);
    if (chapter) {
      renderChapter(layout.main, chapter, route.apiId);
    } else {
      renderHome(layout.main);
    }
  } else {
    renderHome(layout.main);
  }

  renderSidebar(layout.sidebarNav, route);
  layout.closeDrawer();

  if (route.name === 'chapter' && route.apiId) {
    requestAnimationFrame(() => {
      const el = document.getElementById(`api-${route.apiId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add('flash');
        window.setTimeout(() => el.classList.remove('flash'), 1800);
      }
    });
  } else {
    window.scrollTo({ top: 0 });
  }
}

initRouter(onRouteChange);
