import { useState, useEffect } from 'react'
import loadScript from './load-script'
import removeScript from './remove-script'

const useGoogleLogin = ({
  onSuccess = () => {},
  onAutoLoadFinished = () => {},
  onFailure = () => {},
  onRequest = () => {},
  onScopeAddSuccess = () => {},
  onScopeAddFailure = () => {},
  onScriptLoadFailure,
  clientId,
  cookiePolicy,
  loginHint,
  hostedDomain,
  autoLoad,
  isSignedIn,
  fetchBasicProfile,
  redirectUri,
  discoveryDocs,
  uxMode,
  scope,
  accessType,
  responseType,
  jsSrc = 'https://apis.google.com/js/api.js',
  prompt
}) => {
  const [loaded, setLoaded] = useState(false)

  function handleSigninSuccess(res, callback) {
    /*
      offer renamed response keys to names that match use
    */
    const basicProfile = res.getBasicProfile()
    const authResponse = res.getAuthResponse(true)
    res.googleId = basicProfile.getId()
    res.tokenObj = authResponse
    res.tokenId = authResponse.id_token
    res.accessToken = authResponse.access_token
    res.profileObj = {
      googleId: basicProfile.getId(),
      imageUrl: basicProfile.getImageUrl(),
      email: basicProfile.getEmail(),
      name: basicProfile.getName(),
      givenName: basicProfile.getGivenName(),
      familyName: basicProfile.getFamilyName()
    }
    callback(res)
  }

  function signIn(e) {
    if (e) {
      e.preventDefault() // to prevent submit if used within form
    }
    if (loaded) {
      const GoogleAuth = window.gapi.auth2.getAuthInstance()
      const options = {
        prompt
      }
      onRequest()
      if (responseType === 'code') {
        GoogleAuth.grantOfflineAccess(options).then(
          res => onSuccess(res),
          err => onFailure(err)
        )
      } else {
        GoogleAuth.signIn(options).then(
          res => handleSigninSuccess(res, onSuccess),
          err => onFailure(err)
        )
      }
    }
  }

  function addScopes(scopes) {
    if (loaded) {
      const options = {
        prompt
      }
      const auth = window.gapi.auth2.getAuthInstance()
      const user = auth.currentUser.get()
      if (responseType === 'code') {
        auth.grantOfflineAccess({ ...options, scope: scopes }).then(
          res => onScopeAddSuccess(res),
          err => onScopeAddFailure(err)
        )
      } else {
        user.grant({ ...options, scope: scopes }).then(
          res => handleSigninSuccess(res, onScopeAddSuccess),
          err => onScopeAddFailure(err)
        )
      }
    }
  }

  useEffect(() => {
    let unmounted = false
    const onLoadFailure = onScriptLoadFailure || onFailure
    loadScript(
      document,
      'script',
      'google-login',
      jsSrc,
      () => {
        const params = {
          client_id: clientId,
          cookie_policy: cookiePolicy,
          login_hint: loginHint,
          hosted_domain: hostedDomain,
          fetch_basic_profile: fetchBasicProfile,
          discoveryDocs,
          ux_mode: uxMode,
          redirect_uri: redirectUri,
          scope,
          access_type: accessType
        }

        if (responseType === 'code') {
          params.access_type = 'offline'
        }

        window.gapi.load('auth2', () => {
          const GoogleAuth = window.gapi.auth2.getAuthInstance()
          if (!GoogleAuth) {
            window.gapi.auth2.init(params).then(
              res => {
                if (!unmounted) {
                  setLoaded(true)
                  const signedIn = isSignedIn && res.isSignedIn.get()
                  onAutoLoadFinished(signedIn)
                  if (signedIn) {
                    handleSigninSuccess(res.currentUser.get(), onSuccess)
                  }
                }
              },
              err => {
                setLoaded(true)
                onAutoLoadFinished(false)
                onLoadFailure(err)
              }
            )
          } else {
            GoogleAuth.then(
              () => {
                if (unmounted) {
                  return
                }
                if (isSignedIn && GoogleAuth.isSignedIn.get()) {
                  setLoaded(true)
                  onAutoLoadFinished(true)
                  handleSigninSuccess(GoogleAuth.currentUser.get(), onSuccess)
                } else {
                  setLoaded(true)
                  onAutoLoadFinished(false)
                }
              },
              err => {
                onFailure(err)
              }
            )
          }
        })
      },
      err => {
        onLoadFailure(err)
      }
    )

    return () => {
      unmounted = true
      removeScript(document, 'google-login')
    }
  }, [])

  useEffect(() => {
    if (autoLoad) {
      signIn()
    }
  }, [loaded])

  return { signIn, loaded, addScopes }
}

export default useGoogleLogin
