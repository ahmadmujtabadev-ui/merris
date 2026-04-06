const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const isProduction = process.env.NODE_ENV === "production";

module.exports = {
  mode: isProduction ? "production" : "development",
  devtool: isProduction ? false : "source-map",
  entry: {
    taskpane: "./src/taskpane/taskpane.ts",
    commands: "./src/commands/commands.ts",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "word/[name].js",
    clean: true,
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: "word/taskpane.html",
      template: "./src/taskpane/taskpane.html",
      chunks: ["taskpane"],
      inject: true,
    }),
    new HtmlWebpackPlugin({
      filename: "word/commands.html",
      template: "./src/commands/commands.html",
      chunks: ["commands"],
      inject: true,
    }),
  ],
  devServer: {
    port: 3003,
    static: {
      directory: path.resolve(__dirname, "dist"),
    },
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    proxy: [
      {
        context: ["/api"],
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    ],
    // ngrok provides HTTPS — serve plain HTTP here
    server: "http",
    allowedHosts: "all",
    hot: true,
  },
};
