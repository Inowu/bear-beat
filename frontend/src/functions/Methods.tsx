
export function returnPricePaypal (plan_id: number) {
    let sub = ''
    console.log(plan_id);
    if (plan_id === 13) return sub = 'P-6U317201FN9017007MUJVFBY';
    if (plan_id === 14) return sub = 'P-1VN62329L4770474AMSHBSZY';
    return sub;
  }