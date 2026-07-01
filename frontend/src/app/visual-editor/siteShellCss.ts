/** Base layout CSS — protects global chrome from CMS page CSS bleed */
export const SITE_SHELL_CSS = `
#arglove-site-shell {
  font-family: 'Plus Jakarta Sans', sans-serif;
  background: #FFFFFF;
  color: #1A1A1A;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
#arglove-site-shell > main {
  flex: 1 0 auto;
  width: 100%;
}
#arglove-site-shell > main.cms-main-offset {
  padding-top: 96px;
}
@media (min-width: 640px) {
  #arglove-site-shell > main.cms-main-offset {
    padding-top: 110px;
  }
}
#arglove-site-shell .arglove-header-cms,
#arglove-site-shell > header,
#arglove-site-shell header[class*="fixed"] {
  font-size: 16px;
}
#arglove-site-shell .arglove-marquee {
  position: relative;
  z-index: 51;
}
`;
