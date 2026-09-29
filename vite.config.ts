import vinext from 'vinext';
import {defineConfig} from 'vite';
import {cloudflare} from '@cloudflare/vite-plugin';
export default defineConfig({
  plugins:[vinext(),cloudflare({
    viteEnvironment:{name:'rsc',childEnvironments:['ssr']},
    inspectorPort:false,
    config:{
      name:'mercato-multivers',
      main:'./worker.ts',
      compatibility_date:'2026-05-15',
      compatibility_flags:['nodejs_compat'],
      d1_databases:[{binding:'DB',database_name:'mercato-multivers',database_id:'00000000-0000-4000-8000-000000000000',migrations_dir:'./drizzle'}],
    },
  })],
});
