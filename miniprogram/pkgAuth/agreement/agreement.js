// pkgAuth/agreement/agreement.js
Page({
  data: {
    updatedAt: '2026-10-16'
  },

  openPrivacyContract() {
    if (wx.openPrivacyContract) wx.openPrivacyContract({});
  }
});
