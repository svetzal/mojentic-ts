import * as api from '../index';
import { contractIdentity, verify } from '../../scripts/test-boundary-contract.cjs';

it('should reject unexpected destinations before transport and preserve configured exchanges', async () => {
  console.log('Source contract identity:', JSON.stringify(contractIdentity()));

  await verify(api);
});
