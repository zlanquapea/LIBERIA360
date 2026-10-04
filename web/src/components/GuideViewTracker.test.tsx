import {render,waitFor} from '@testing-library/react';
import {GuideViewTracker} from './GuideViewTracker';
import {apiRequest} from '@/lib/http';
jest.mock('@/lib/http',()=>({apiRequest:jest.fn().mockResolvedValue(null)}));
const request=apiRequest as jest.Mock;
beforeEach(()=>{sessionStorage.clear();request.mockClear();Object.defineProperty(crypto,'randomUUID',{configurable:true,value:jest.fn().mockReturnValue('11111111-1111-4111-8111-111111111111')})});
it('reuses an event id for repeat visits within 30 minutes',async()=>{
 const first=render(<GuideViewTracker guideId="g"/>);await waitFor(()=>expect(request).toHaveBeenCalledTimes(1));first.unmount();
 (crypto.randomUUID as jest.Mock).mockReturnValue('22222222-2222-4222-8222-222222222222');
 render(<GuideViewTracker guideId="g"/>);await waitFor(()=>expect(request).toHaveBeenCalledTimes(2));
 expect(JSON.parse(request.mock.calls[0][1].body).id).toBe(JSON.parse(request.mock.calls[1][1].body).id);
});
it('starts a new event after the time window expires',async()=>{
 sessionStorage.setItem('guide-view:g',JSON.stringify({id:'old',at:Date.now()-31*60*1000}));render(<GuideViewTracker guideId="g"/>);
 await waitFor(()=>expect(request).toHaveBeenCalledTimes(1));expect(JSON.parse(request.mock.calls[0][1].body).id).not.toBe('old');
});
