const Razorpay = require('razorpay');

function isMockMode() {
  if (process.env.NODE_ENV === 'test') return true;

  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  const forceMock = String(process.env.FORCE_MOCK_RAZORPAY || '').toLowerCase() === 'true';
  if (forceMock) return true;

  const keyId = process.env.RAZORPAY_KEY_ID;
  return !keyId || keyId.includes('here') || keyId === 'dummy_id';
}

function getRazorpay() {
  if (isMockMode()) return null;
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

/** @returns {Promise<{ id: string, status: string }>} */
async function refundPayment(razorpayPaymentId, amountPaise) {
  if (isMockMode()) {
    return {
      id: `rfnd_mock_${Date.now().toString(36)}`,
      status: 'processed',
    };
  }

  const rp = getRazorpay();
  const refund = await rp.payments.refund(razorpayPaymentId, {
    amount: amountPaise,
    speed: 'normal',
    notes: { reason: 'Order cancelled / refund requested by admin' },
  });
  return { id: refund.id, status: refund.status || 'processed' };
}

module.exports = { isMockMode, getRazorpay, refundPayment };
