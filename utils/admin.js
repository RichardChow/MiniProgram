// 管理员验证工具类
const AdminUtil = {
  // 密码加密存储
  encryptPassword(password) {
    // 使用适当的加密算法
    return md5(password + 'salt');  // 示例使用md5
  },

  // 验证密码
  validatePassword(inputPassword, storedPassword) {
    return this.encryptPassword(inputPassword) === storedPassword;
  },

  // 检查管理员登录状态
  checkAdminStatus() {
    return wx.getStorageSync('adminLogin') || false;
  },

  // 退出登录
  logout() {
    wx.removeStorageSync('adminLogin');
    getApp().globalData.isAdmin = false;
  }
};

export default AdminUtil; 