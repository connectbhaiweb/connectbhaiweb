declare module 'react-native-razorpay' {
  const RazorpayCheckout: {
    open(options: object): Promise<{ razorpay_payment_id: string; razorpay_signature: string; razorpay_order_id?: string }>;
  };
  export default RazorpayCheckout;
}
