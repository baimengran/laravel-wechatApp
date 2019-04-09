import wepy from 'wepy'

// 服务器接口地址
/* global __BASE_URL__ */
const host = __BASE_URL__

/**
 * 普通请求
 * @param options 请求url
 * @param showLoading 显示加载中提示，默认true
 * @returns {Promise<any>} 接口请求返回信息
 */
const request = async (options, showLoading = true) => {
    // 简化开发，如果传入字符串则转换成对象
  if (typeof options === 'string') {
    options = {
      url: options
    }
  }

    // 显示加载中
  if (showLoading) {
    wepy.showLoading({title: '加载中'})
  }
    // 拼接请求地址
  options.url = host + '/' + options.url
    // 调用小程序的request方法
  let response = await wepy.request(options)

  if (showLoading) {
        // 隐藏加载中
    wepy.hideLoading()
  }

    // 服务器异常后给出提示
  if (response.statusCode === 500) {
    wepy.showModal({
      title: '提示',
      content: '服务器错误，请联系管理员或重试'
    })
  }
  return response
}

/**
 * 登录
 * @param params 登录携带参数
 * @returns {Promise<any>} 登录后response信息
 */
const login = async (params = {}) => {
    // code 只能使用一次，每次单独调用
  let loginData = await wepy.login()

    // 参数中增加code
  params.code = loginData.code

    // 接口去请求 weapp/authorizations
  let authResponse = await request({
    url: 'weapp/authorizations',
    data: params,
    method: 'POST'
  })

    // 登录成功，记录token信息
  if (authResponse.statusCode === 201) {
    wepy.setStorageSync('access_token', authResponse.data.access_token)
    wepy.setStorageSync('access_token_expired_at', new Date().getTime() + authResponse.data.expires_in * 1000)
  }

  return authResponse
}

/**
 * 刷新Token
 * @param accessToken 当前登录token
 * @returns {Promise<any>} 新token及过期时间
 */
const refreshToken = async (accessToken) => {
    // 请求刷新接口
  let refreshResponse = await wepy.request({
    url: host + '/' + 'authorizations/current',
    method: 'PUT',
    header: {
      'Authorization': 'Bearer ' + accessToken
    }
  })

    // 刷新成功状态码为200
  if (refreshResponse.statusCode === 200) {
        // 将token及过期时间保存在storage中
    wepy.setStorageSync('access_token', refreshResponse.data.access_token)
    wepy.setStorageSync('access_token_expired_at', new Date().getTime() + refreshResponse.data.expires_in * 1000)
  }

  return refreshResponse
}

/**
 * 获取token
 * @param options
 * @returns {Promise<*>}
 */
const getToken = async (options) => {
    // 从缓存中取出token
  let accessToken = wepy.getStorageSync('access_token')
  let expiredAt = wepy.getStorageSync('access_token_expired_at')

    // 如果token过期了，则调用刷新方法
  if (accessToken && new Date().getTime() > expiredAt) {
    let refreshResponse = await refreshToken(accessToken)
        // 刷新成功
    if (refreshResponse.statusCode === 200) {
      accessToken = refreshResponse.data.access_token
    } else {
            // 刷新失败，重新调用登录方法，设置token
      let authResponse = await login()
      if (authResponse.statusCode === 201) {
        accessToken = authResponse.data.access_token
      }
    }
  }
  return accessToken
}

/**
 * 带身份认证的请求
 * @param options 请求对象信息
 * @param showLoading
 * @returns {Promise<any>}
 */
const authRequest = async (options, showLoading = true) => {
    // 如果参数是字符串，转换成对象
  if (typeof options === 'string') {
    options = {
      url: options
    }
  }
    // 获取token
  let accessToken = await getToken()

    // 将token设置在header中
  let header = options.header || {}
  header.Authorization = 'Bearer ' + accessToken
  options.header = header

  return request(options, showLoading)
}

/**
 * 退出登录
 * @param params
 * @returns {Promise<any>}
 */
const logout = async (params = {}) => {
    // 从缓存中取出token
  let accessToken = wepy.getStorageSync('access_token')
  let expiredAt = wepy.getStorageSync('access_token_expired_at')

    // 如果token过期了，则调用刷新方法
  if (accessToken && new Date().getTime() > expiredAt) {
    let refreshResponse = await refreshToken(accessToken)
        // 刷新成功
    if (refreshResponse.statusCode === 200) {
      accessToken = refreshResponse.data.access_token
    } else {
            // 刷新失败，重新调用登录方法，设置token
      let authResponse = await login()
      if (authResponse.statusCode === 201) {
        accessToken = authResponse.data.access_token
      }
    }
  }
    // 调用删除token接口,让token失效
  let logoutResponse = await wepy.request({
    url: host + '/' + 'authorizations/current',
    method: 'DELETE',
    header: {
      'Authorization': 'Bearer ' + accessToken
    }
  })

    // 调用接口成功则清空缓存
  if (logoutResponse.statusCode === 204) {
    wepy.clearStorage()
  }
  return logoutResponse
}

/**
 * 上传文件
 * @param options
 * @returns {Promise<*>}
 */
const updateFile = async (options = {}) => {
  // 显示loading
  wepy.showLoading({title: '文件上传中'})

    // 获取token
  let accessToken = await getToken()

    // 拼接url
  options.url = host + '/' + options.url
  let header = options.header || {}
    // 将token设置在header中
  header.Authorization = 'Bearer ' + accessToken
  options.header = header

    // 上传文件
  let response = await wepy.uploadFile(options)

    // 隐藏loading
  wepy.hideLoading()

  return response
}

export default {
  request, // 普通请求
  login, // 登录
  refreshToken, // 刷新token
  authRequest, // 身份认证求情
  logout, // 退出登录
  updateFile// 上传文件
}
