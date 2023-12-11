// vite.config.ts
import { resolve } from "path";
import { defineConfig } from "file:///home/hramovich/work/headless-cms-gpt-sdk/node_modules/vite/dist/node/index.js";
import { exec } from "child_process";
import dts from "file:///home/hramovich/work/headless-cms-gpt-sdk/node_modules/vite-plugin-dts/dist/index.mjs";
var __vite_injected_original_dirname = "/home/hramovich/work/headless-cms-gpt-sdk/packages/content-ai-sdk";
var vite_config_default = defineConfig({
  build: {
    lib: {
      entry: resolve(__vite_injected_original_dirname, "src/index.ts"),
      name: "my-lib",
      fileName: "my-lib"
    }
  },
  plugins: [
    dts(),
    {
      name: "yalc-publish",
      closeBundle() {
        exec("yalc push");
      }
    }
  ],
  test: {
    // ...
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9ocmFtb3ZpY2gvd29yay9oZWFkbGVzcy1jbXMtZ3B0LXNkay9wYWNrYWdlcy9jb250ZW50LWFpLXNka1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2hvbWUvaHJhbW92aWNoL3dvcmsvaGVhZGxlc3MtY21zLWdwdC1zZGsvcGFja2FnZXMvY29udGVudC1haS1zZGsvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2hvbWUvaHJhbW92aWNoL3dvcmsvaGVhZGxlc3MtY21zLWdwdC1zZGsvcGFja2FnZXMvY29udGVudC1haS1zZGsvdml0ZS5jb25maWcudHNcIjsvLy8gPHJlZmVyZW5jZSB0eXBlcz1cInZpdGVzdFwiIC8+XG4vLyBDb25maWd1cmUgVml0ZXN0IChodHRwczovL3ZpdGVzdC5kZXYvY29uZmlnLylcblxuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gXCJwYXRoXCI7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHsgZXhlYyB9IGZyb20gXCJjaGlsZF9wcm9jZXNzXCI7XG5pbXBvcnQgZHRzIGZyb20gXCJ2aXRlLXBsdWdpbi1kdHNcIjtcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2d1aWRlL2J1aWxkLmh0bWwjbGlicmFyeS1tb2RlXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBidWlsZDoge1xuICAgIGxpYjoge1xuICAgICAgZW50cnk6IHJlc29sdmUoX19kaXJuYW1lLCBcInNyYy9pbmRleC50c1wiKSxcbiAgICAgIG5hbWU6IFwibXktbGliXCIsXG4gICAgICBmaWxlTmFtZTogXCJteS1saWJcIixcbiAgICB9LFxuICB9LFxuICBwbHVnaW5zOiBbXG4gICAgZHRzKCksXG4gICAge1xuICAgICAgbmFtZTogXCJ5YWxjLXB1Ymxpc2hcIixcbiAgICAgIGNsb3NlQnVuZGxlKCkge1xuICAgICAgICBleGVjKFwieWFsYyBwdXNoXCIpO1xuICAgICAgfSxcbiAgICB9LFxuICBdLFxuICB0ZXN0OiB7XG4gICAgLy8gLi4uXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFHQSxTQUFTLGVBQWU7QUFDeEIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxZQUFZO0FBQ3JCLE9BQU8sU0FBUztBQU5oQixJQUFNLG1DQUFtQztBQVN6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixPQUFPO0FBQUEsSUFDTCxLQUFLO0FBQUEsTUFDSCxPQUFPLFFBQVEsa0NBQVcsY0FBYztBQUFBLE1BQ3hDLE1BQU07QUFBQSxNQUNOLFVBQVU7QUFBQSxJQUNaO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsSUFBSTtBQUFBLElBQ0o7QUFBQSxNQUNFLE1BQU07QUFBQSxNQUNOLGNBQWM7QUFDWixhQUFLLFdBQVc7QUFBQSxNQUNsQjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxNQUFNO0FBQUE7QUFBQSxFQUVOO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
