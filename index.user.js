// ==UserScript==
// @name refined-twitter-lite
// @description Small UserScript that adds some UI improvements to Twitter Lite
// @version 0.2.9
// @match https://twitter.com/*
// @match https://mobile.twitter.com/*
// ==/UserScript==
(function () {
  const isEnglish = (document.documentElement.getAttribute('lang') || '').startsWith('en')

  // Supported features.
  // Can optionally define a test function that must return a boolean.
  const features = {
    singleColumn: {
      default: true,
      test: ({ parsedUrl }) => {
        return /^((?!messages|settings).)*$/.test(parsedUrl.pathname)
      },
      styles: [
        '[data-testid="sidebarColumn"] { display: none }',
        '.r-1ye8kvj { min-width: 675px }'
      ]
    },
    composeButtonTextCursor: {
      default: true,
      styles: [
        `[href="/compose/tweet"] [dir] { cursor: text }`
      ]
    },
    hideLikeCount: {
      default: false,
      styles: [
        `[href$="/likes"],
         [data-testid="like"] span,
         [data-testid="unlike"] span {
            display: none
         }`
      ]
    },
    hideRetweetCount: {
      default: false,
      styles: [
        `[href$="/retweets"],
         [data-testid="retweet"] span,
         [data-testid="unretweet"] span {
            display: none
         }`
      ]
    },
    hideReplyCount: {
      default: false,
      styles: [
        `[data-testid="reply"] span { display: none }`
      ]
    },
    hideAvatars: {
      default: false,
      styles: [
        `[style*="/profile_images/"] {
          background-image: none !important;
          background-color: #f8f8f8;
        }`
      ]
    },
    obfuscateHandlesAndUserNames: {
      default: false,
      styles: [
        `[data-testid="tweet"] [href^="/"]:not([aria-hidden]):not([href*="/status/"]),
         [data-testid="UserCell"] [href^="/"]:not([aria-hidden]):not([href*="/status/"]) {
            filter: blur(3px)
         }
        `
      ]
    },
    hideHandlesAndUserNames: {
      default: false,
      styles: [
        `[data-testid="tweet"] [href^="/"]:not([aria-hidden]):not([href*="/status/"]),
         [data-testid="UserCell"] [href^="/"]:not([aria-hidden]):not([href*="/status/"]) {
            display: none
         }
        `
      ]
    },
    enforceLatestTweets: {
      default: true,
      test: ({ parsedUrl }) => {
        const { pathname } = parsedUrl
        return pathname === '/home'
      },
      init: () => {
        let abort = false
        waitUntil(() => {
          if (abort) {
            throw new Error('aborted')
          }
          const elements = document.querySelectorAll('[data-testid="primaryColumn"] time')
          if (elements.length) {
            return elements
          }
          return false
        }, 500)
          .then(timeElements => {
            if (abort) {
              return
            }
            let lastTime = null
            const isShowingLatest =
              isEnglish
                ? document.title.startsWith('Latest')
                : [].every.call(
                    timeElements,
                    time => {
                      const currentTime = new Date(time.getAttribute('datetime'))
                      const isChronological = !lastTime || lastTime > currentTime
                      lastTime = currentTime
                      return isChronological
                    }
                  )

            if (!isShowingLatest) {
              let node = document.querySelector('[data-testid="primaryColumn"] [role="heading"]')
              node = node && node.parentNode.parentNode
              node = node && node.querySelector('[role="button"]')
              node && node.click()

              setTimeout(() => {
                node = node && document.querySelector('[role="menu"] [role="menuitem"]')
                node && node.click()
              })
            }
          })
          .catch(noop)

        return () => {
          abort = true
        }
      }
    },
    isExploreLinkLast: {
      default: false,
      styles: [
        `nav [href="/explore"] {
            order: 3;
         }`
      ]
    },
    hideExploreLink: {
      default: true,
      styles: [
        `nav [href="/explore"] {
            display: none
         }`
      ]
    },
    oldTwitterFontsStack: {
      default: false,
      styles: [
        `.r-1qd0xha {
            font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
            -webkit-font-smoothing: antialiased
        }`
      ]
    },
    hideTimelineSpam: {
      default: true,
      test: ({ parsedUrl }) => {
        return /^((?!\/following|\/followers|\/followers_you_follow).)*$/.test(parsedUrl.pathname)
      },
      styles: [
        `[data-testid="primaryColumn"] [role="region"] [role="heading"]:not([aria-level="1"]),
         [data-testid="primaryColumn"] [role="button"][data-testid="UserCell"],
         [href^="/search?q="][href*="&f=user"],
         [href^="/i/related_users"],
         [href="/who_to_follow"] {
            display: none
        }`
      ]
    },
    delayTweet: {
      default: 0,
      init: () => {
        const selector = '[data-testid="tweetButton"]'
        let lastPointerDownEventTime = Date.now()
        let timeout = null
        let btn = null
        let delayBtn = null
        let tweeting = false

        function findBtn(target) {
          if (target.matches(selector)) {
            return target
          }
          return target.closest(selector)
        }
        function abort() {
          if (timeout) {
            timeout = clearTimeout(timeout)
          }
          if (!btn) { return }
          btn.style.display = null
          if (!delayBtn) { return }
          btn.parentNode.removeChild(delayBtn)
          delayBtn = null
        }
        function handleEvent(event) {
          // When programmatically tweeting.
          if (tweeting || timeout) { return }
          btn = findBtn(event.target)
          if (!btn || btn.getAttribute('aria-disabled') === 'true') { return }
          lastPointerDownEventTime = Date.now()
          btn.addEventListener('click', event => {
            // Long press: preserve the default behavior -> tweet
            if (Date.now() - lastPointerDownEventTime > 500) {
              return
            }
            event.preventDefault()
            event.stopPropagation()
            delayBtn = btn.cloneNode(true)
            delayBtn.style.backgroundColor = '#ca2055'
            delayBtn.addEventListener('click', abort)
            const delayBtnTextContainer = [].find.call(
              delayBtn.querySelectorAll('*'),
              node => node.childNodes[0].nodeType === 3
            )
            btn.style.display = 'none'
            btn.parentNode.appendChild(delayBtn)

            let countDown = typeof settings.delayTweet !== 'number'
              ? 10
              : settings.delayTweet
            function timer() {
              if (countDown === -1) {
                abort()
                tweeting = true
                btn.click()
                tweeting = false
                btn = null
                return
              }
              if (countDown === 0) {
                delayBtnTextContainer.textContent = '💥'
                countDown--
              } else {
                delayBtnTextContainer.textContent = isEnglish
                  ? `Abort ${countDown--}`
                  : `🕐 ${countDown--}`
              }
              timeout = setTimeout(timer, 1000)
            }
            timeout = setTimeout(timer)
          }, { capture: true, once: true })
        }

        document.addEventListener('pointerdown', handleEvent)
        return () => {
          document.removeEventListener('pointerdown', handleEvent)
          abort()
          tweeting = false
          btn = null
        }
      }
    }
  }

  // Generate and append the styles.
  document.head.insertAdjacentHTML('beforeend', `
    <style>
      ${Object.entries(features).map(([feature, data]) =>
        (data.styles || []).map(rule =>
          rule.split(',').map(rule =>
            `[data-refined-twitter-lite~="${feature}"] ${rule.trim()}`
          ).join(',')
        ).join('')
      ).join("\n")}
    </style>
  `)

  // Settings are saved to localStorage and merged with the default on load.
  const storageKey = 'refined-twitter-lite'
  let settings = {}
  const storedSettings = JSON.parse(localStorage.getItem(storageKey)) || {}
  settings = Object.keys(features).reduce((settings, feature) => {
    if (storedSettings.hasOwnProperty(feature)) {
      settings[feature] = storedSettings[feature]
    } else {
      settings[feature] = features[feature].default
    }
    return settings
  }, {})

  let initCleanupFunctions = []

  function setFeatures(url = window.location.href) {
    initCleanupFunctions.forEach(cleanupFunction => cleanupFunction())
    initCleanupFunctions = []

    const parsedUrl = document.createElement('a')
    parsedUrl.href = url

    const enabledFeatures = Object.keys(features).filter(feature =>
      settings[feature] &&
      (!features[feature].test ||
      features[feature].test({ parsedUrl, title: document.title || '' }))
    )
    document.documentElement.setAttribute('data-refined-twitter-lite', enabledFeatures.join(' '))

    // Features can define an init function that is called every time setFeatures is invoked.
    enabledFeatures.forEach(featureName => {
      const feature = features[featureName]
      if (typeof feature.init === 'function') {
        const cleanupFunction = feature.init()
        if (typeof cleanupFunction !== 'function') {
          throw new Error(
            'Refined Twitter Lite: the feature.init function must return a cleanup function.'
          )
        }
        initCleanupFunctions.push(cleanupFunction)
      }
    })
  }

  // Customize/Save settings API
  // setRefinedTwitterLiteFeatures is available to the user
  // and can be called with the new settings object (can be partial).
  // New settings are merged with the current ones.
  window.setRefinedTwitterLiteFeatures = features => {
    settings = Object.assign(settings, features)
    localStorage.setItem(storageKey, JSON.stringify(settings))
    setFeatures()
  }

  const events = {
    setFeatures: setRefinedTwitterLiteFeatures,
    refresh: setFeatures
  }

  window.addEventListener('RefinedTwitterLite', ({ detail }) => {
    const { type, payload } = detail
    events[type] && events[type](payload)
  })

  window.addEventListener('beforeunload', () => {
    setRefinedTwitterLiteFeatures(settings)
  })

  window.addEventListener('popstate', () => {
    setFeatures()
  })

  injectScript(`
    window.RefinedTwitterLite = {
      dispatch: (type, payload) => {
        window.dispatchEvent(new CustomEvent('RefinedTwitterLite', {
          detail: {
            type,
            payload
          }
        }))
      }
    }

    RefinedTwitterLite.setFeatures = features => {
      RefinedTwitterLite.dispatch('setFeatures', features)
    }

    RefinedTwitterLite.refresh = url => {
      RefinedTwitterLite.dispatch('refresh', url)
    }

    {
      let prevUrl = window.location.pathname
      const pushState = history.pushState
      history.pushState = function () {
        const url = arguments[2]
        prevUrl !== url && RefinedTwitterLite.refresh(arguments[2])
        prevUrl = url
        pushState.apply(history, arguments)
      }
      const replaceState = history.replaceState
      history.replaceState = function () {
        const url = arguments[2]
        prevUrl !== url && RefinedTwitterLite.refresh(arguments[2])
        prevUrl = url
        replaceState.apply(history, arguments)
      }
    }
  `)

  setFeatures()

  function injectScript(source) {
    const { nonce } = document.querySelector('script[nonce]')
    const script = document.createElement('script')
    script.nonce = nonce
    script.textContent = source
    document.documentElement.appendChild(script)
  }
  function noop() {}
  async function waitUntil(fn, retryTimeout, times = 6) {
    if (times === 0) {
      throw new Error("waitUntil: max retry limit reached")
    }
    const result = fn()
    if (result) {
      if (result instanceof Promise) {
        return await result
      }
      return result
    }
    await new Promise(resolve => setTimeout(resolve, retryTimeout))
    return await waitUntil(fn, retryTimeout, times - 1)
  }
}())
