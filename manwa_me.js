/** @type {import('./_venera_.js')} */

const MANWA_DEFAULT_BASE_URLS = [
  "https://manwa.me",
  "http://manwafw.cc",
  "http://manwaqp.cc",
  "http://manwara.cc",
];

const MANWA_LOGIN_URL =
  "https://manwa.me/booklist?tag=&end=&gender=0&has_full=-1&area=2&sort=-1&level=-1";

const MANWA_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0.0.0 Safari/537.36";

class ManwaMe extends ComicSource {
  name = "漫蛙漫画";

  key = "manwa_me";

  version = "1.0.2";

  minAppVersion = "1.4.6";

  // 发布仓库中的更新地址。
  url =
    "https://raw.githubusercontent.com/shixuit/venera-next-manwa-me-source/main/manwa_me.js";

  settings = {
    base_urls: {
      title: "站点地址（英文逗号分隔，首选在前）",
      type: "input",
      validator: "^https?://.+$",
      default: MANWA_DEFAULT_BASE_URLS.join(","),
    },
  };

  account = {
    // 只在受保护的分类页加载完成后才结束 WebView，避免主页刚打开就误判为登录成功。
    loginWithWebview: {
      url: MANWA_LOGIN_URL,
      checkStatus: (url, title) => {
        if (!url || !title) return false;
        if (!/^https:\/\/manwa\.me\/booklist(?:[/?#]|$)/i.test(url)) {
          return false;
        }
        const value = title.toLowerCase();
        if (
          value.indexOf("just a moment") !== -1 ||
          value.indexOf("cloudflare") !== -1 ||
          value.indexOf("challenge") !== -1
        ) {
          return false;
        }
        return true;
      },
    },

    loginWithCookies: {
      fields: ["cf_clearance"],
      validate: async (values) => {
        if (!values || !values[0]) return false;
        Network.setCookies("https://manwa.me", [
          new Cookie({
            name: "cf_clearance",
            value: values[0],
            domain: ".manwa.me",
          }),
        ]);
        try {
          const response = await Network.get(
            "https://manwa.me/booklist",
            this._headers("https://manwa.me", false),
          );
          return (
            response.status === 200 &&
            !this._isChallengeOrBlockPage(response.status, response.body)
          );
        } catch (_) {
          return false;
        }
      },
    },

    logout: () => {
      Network.deleteCookies("https://manwa.me");
    },

    registerWebsite: null,
  };

  get baseUrls() {
    const configured =
      this.loadSetting("base_urls") || this.settings.base_urls.default;
    const urls = String(configured)
      .split(",")
      .map((item) => this._normalizeBaseUrl(item))
      .filter((item) => item !== "");

    const unique = [];
    for (const item of urls) {
      if (unique.indexOf(item) === -1) unique.push(item);
    }

    const active = this.loadData("active_base_url");
    if (active && unique.indexOf(active) !== -1) {
      unique.splice(unique.indexOf(active), 1);
      unique.unshift(active);
    }
    return unique.length > 0 ? unique : MANWA_DEFAULT_BASE_URLS;
  }

  _normalizeBaseUrl(value) {
    let url = String(value || "").trim();
    if (!url) return "";
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    return url.replace(/\/+$/, "");
  }

  _headers(baseUrl, json) {
    return {
      "User-Agent": MANWA_USER_AGENT,
      Referer: baseUrl + "/",
      Accept: json
        ? "application/json, text/javascript, */*; q=0.01"
        : "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.7",
      ...(json ? { "X-Requested-With": "XMLHttpRequest" } : {}),
    };
  }

  _isChallengeOrBlockPage(status, body) {
    const text = String(body || "").toLowerCase();
    if (status === 403 || status === 503) return true;
    return (
      text.indexOf("challenge-platform") !== -1 ||
      text.indexOf("cf-browser-verification") !== -1 ||
      text.indexOf("just a moment") !== -1 ||
      text.indexOf("__cf_chl_") !== -1 ||
      text.indexOf("江苏反诈网") !== -1
    );
  }

  async _request(path, json) {
    const failures = [];
    for (const baseUrl of this.baseUrls) {
      const url = /^https?:\/\//i.test(path) ? path : baseUrl + path;
      try {
        const response = await Network.get(url, this._headers(baseUrl, json));
        if (
          response.status === 200 &&
          !this._isChallengeOrBlockPage(response.status, response.body)
        ) {
          this.saveData("active_base_url", baseUrl);
          return { response, baseUrl };
        }
        failures.push(baseUrl + ": HTTP " + response.status);
      } catch (error) {
        failures.push(baseUrl + ": " + String(error));
      }
    }

    throw (
      "漫蛙连接失败。可在漫画源设置中点击“登录”完成 Cloudflare 验证，" +
      "或更新站点地址。尝试结果：" +
      failures.join("；")
    );
  }

  _absoluteUrl(value, baseUrl) {
    const url = String(value || "").trim();
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    if (url.indexOf("//") === 0) return "https:" + url;
    return baseUrl + (url.indexOf("/") === 0 ? url : "/" + url);
  }

  _optionValue(value, fallback) {
    const text = String(value ?? "");
    const separator = text.indexOf("-");
    const result = separator === -1 ? text : text.substring(0, separator);
    return result || fallback;
  }

  _parseJsonComic(item, baseUrl) {
    const status = Number(item.end) === 1 ? "已完结" : "连载中";
    const tags = String(item.tags || "")
      .split("|")
      .map((tag) => tag.trim())
      .filter((tag) => tag !== "");
    return new Comic({
      id: String(item.param || item.id),
      title: String(item.book_name || ""),
      subTitle: [status, item.last_chapter || ""].filter(Boolean).join(" · "),
      cover: this._absoluteUrl(item.cover_url || "", baseUrl),
      tags,
      description: String(item.summary || ""),
      language: "zh-Hans",
    });
  }

  async _loadBookList(filters, page) {
    const values = {
      page: page || 1,
      tag: filters.tag || "",
      end: filters.end || "",
      gender:
        filters.gender === undefined || filters.gender === null
          ? "-1"
          : filters.gender,
      has_full: "-1",
      area: filters.area || "",
      sort:
        filters.sort === undefined || filters.sort === null
          ? "-1"
          : filters.sort,
      level: "-1",
    };
    const query = Object.keys(values)
      .map((key) => key + "=" + encodeURIComponent(String(values[key])))
      .join("&");
    const { response, baseUrl } = await this._request(
      "/getBooks?" + query,
      true,
    );

    let data;
    try {
      data = JSON.parse(response.body);
    } catch (_) {
      throw "漫蛙分类接口返回了无法解析的内容";
    }
    if (data.err && Number(data.err) !== 0) {
      throw "漫蛙分类接口错误：" + String(data.err);
    }

    const books = Array.isArray(data.books) ? data.books : [];
    return {
      comics: books
        .filter((item) => item && !item.blocked)
        .map((item) => this._parseJsonComic(item, baseUrl)),
      maxPage: books.length < 12 ? Number(page || 1) : null,
    };
  }

  explore = [
    {
      title: "最近更新",
      type: "multiPageComicList",
      load: async (page) =>
        this._loadBookList(
          { tag: "", end: "", gender: "-1", area: "", sort: "-1" },
          page,
        ),
    },
    {
      title: "韩国 BL",
      type: "multiPageComicList",
      load: async (page) =>
        this._loadBookList(
          { tag: "", end: "", gender: "0", area: "2", sort: "-1" },
          page,
        ),
    },
    {
      title: "韩国漫画",
      type: "multiPageComicList",
      load: async (page) =>
        this._loadBookList(
          { tag: "", end: "", gender: "-1", area: "2", sort: "-1" },
          page,
        ),
    },
  ];

  category = {
    title: "漫蛙漫画",
    parts: [
      {
        name: "标签",
        type: "fixed",
        categories: [
          "全部",
          "韩漫",
          "日漫",
          "国漫",
          "完整版",
          "恋爱",
          "都市",
          "校园",
          "搞笑",
          "玄幻",
          "奇幻",
          "冒险",
        ],
        itemType: "category",
        categoryParams: [
          "",
          "韩漫",
          "日漫",
          "国漫",
          "完整版",
          "恋爱",
          "都市",
          "校园",
          "搞笑",
          "玄幻",
          "奇幻",
          "冒险",
        ],
      },
    ],
    enableRankingPage: false,
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      const genderMap = {
        all: "-1",
        general: "2",
        bl: "0",
        adult: "1",
        tl: "3",
        gl: "4",
      };
      const areaMap = {
        all: "",
        kr: "2",
        jp: "3",
        cn: "4",
        tw: "5",
        other: "6",
      };
      const endMap = { all: "", serial: "2", completed: "1" };
      const sortMap = { latest: "-1", oldest: "0", favorite: "1", new: "2" };
      const gender = this._optionValue(options[0], "all");
      const area = this._optionValue(options[1], "all");
      const end = this._optionValue(options[2], "all");
      const sort = this._optionValue(options[3], "latest");
      return this._loadBookList(
        {
          tag: param || "",
          gender: genderMap[gender] ?? "-1",
          area: areaMap[area] ?? "",
          end: endMap[end] ?? "",
          sort: sortMap[sort] ?? "-1",
        },
        page,
      );
    },
    optionList: [
      {
        options: [
          "all-全部",
          "general-一般向",
          "bl-BL向",
          "adult-禁漫",
          "tl-TL向",
          "gl-GL向",
        ],
      },
      {
        options: [
          "all-全部地区",
          "kr-韩国",
          "jp-日本",
          "cn-中国大陆",
          "tw-台湾",
          "other-其他",
        ],
      },
      {
        options: ["all-全部状态", "serial-连载中", "completed-已完结"],
      },
      {
        options: [
          "latest-最新",
          "oldest-最旧",
          "favorite-收藏",
          "new-新漫",
        ],
      },
    ],
  };

  _parseSearchComic(item) {
    const link = item.querySelector(".book-list-cover > a");
    const href = link?.attributes?.["href"] || "";
    const idMatch = href.match(/\/book\/(\d+)/);
    if (!idMatch) return null;

    const titleNode = item.querySelector(".book-list-info-title");
    const coverNode = item.querySelector(".book-list-cover-img");
    const authorNode = item.querySelector(".book-list-info-bottom-item");
    const statusNode = item.querySelector(".book-list-info-bottom-right-font");
    const descriptionNode = item.querySelector(".book-list-info-desc");
    const author = (authorNode?.text || "").replace(/^作者[：:]\s*/, "").trim();
    const status = (statusNode?.text || "").trim();

    return new Comic({
      id: idMatch[1],
      title: (titleNode?.text || link?.attributes?.["title"] || idMatch[1]).trim(),
      subTitle: [author, status].filter(Boolean).join(" · "),
      cover:
        coverNode?.attributes?.["data-original"] ||
        coverNode?.attributes?.["src"] ||
        "",
      tags: status ? [status] : [],
      description: (descriptionNode?.text || "").trim(),
      language: "zh-Hans",
    });
  }

  search = {
    load: async (keyword, options, page) => {
      const currentPage = Number(page || 1);
      const query =
        "?keyword=" +
        encodeURIComponent(keyword) +
        (currentPage > 1 ? "&page=" + currentPage : "");
      const { response } = await this._request("/search" + query, false);
      const document = new HtmlDocument(response.body);
      const comics = document
        .querySelectorAll("ul.book-list > li")
        .map((item) => this._parseSearchComic(item))
        .filter((item) => item !== null);

      let hasNext = false;
      for (const link of document.querySelectorAll(".pagination2 a[data-page]")) {
        const value = Number(link.attributes["data-page"] || 0);
        if (value > currentPage) {
          hasNext = true;
          break;
        }
      }
      document.dispose();
      return {
        comics,
        maxPage: hasNext ? currentPage + 1 : currentPage,
      };
    },
    optionList: [],
  };

  comic = {
    loadInfo: async (id) => {
      const { response, baseUrl } = await this._request("/book/" + id, false);
      const document = new HtmlDocument(response.body);

      const title =
        document.querySelector(".detail-main-info-title")?.text.trim() ||
        String(id);
      const coverNode = document.querySelector(".detail-main-cover img");
      const cover = this._absoluteUrl(
        coverNode?.attributes?.["data-original"] ||
          coverNode?.attributes?.["src"] ||
          "",
        baseUrl,
      );
      const description =
        document.querySelector(".detail-desc")?.text.trim() || "";

      const metadata = {};
      for (const row of document.querySelectorAll(".detail-main-info-author")) {
        const field = row
          .querySelector(".detail-main-info-author-field")
          ?.text.replace(/[：:]\s*$/, "")
          .trim();
        const value = row
          .querySelector(".detail-main-info-value")
          ?.text.trim();
        if (field && value) metadata[field] = value;
      }

      const tagList = document
        .querySelectorAll(".detail-main-info-class .info-tag-span")
        .map((node) => node.text.trim())
        .filter((value) => value !== "");

      const chapters = new Map();
      for (const link of document.querySelectorAll(
        "#detail-list-select a.chapteritem",
      )) {
        const href = link.attributes["href"] || "";
        const match = href.match(/\/chapter\/(\d+)/);
        if (!match) continue;
        chapters.set(
          match[1],
          (link.attributes["title"] || link.text || match[1]).trim(),
        );
      }

      const tagGroups = { 标签: tagList };
      for (const key of ["作者", "别名", "更新状态", "地区", "类别"]) {
        if (metadata[key]) tagGroups[key] = [metadata[key]];
      }

      const updateText =
        document
          .querySelector("#detail-list-title .detail-list-title-3")
          ?.text.trim()
          .replace(/更新$/, "") || "";
      document.dispose();

      return new ComicDetails({
        title,
        subTitle: metadata["作者"] || "",
        cover,
        description,
        tags: tagGroups,
        chapters,
        updateTime: updateText,
        url: baseUrl + "/book/" + id,
      });
    },

    loadEp: async (comicId, epId) => {
      const { response, baseUrl } = await this._request(
        "/chapter/" + encodeURIComponent(epId),
        false,
      );
      const document = new HtmlDocument(response.body);
      const images = [];
      const seen = new Set();
      for (const node of document.querySelectorAll(
        "#cp_img .img-content img.content-img",
      )) {
        const value =
          node.attributes["data-r-src"] ||
          node.attributes["data-original"] ||
          node.attributes["src"] ||
          "";
        const image = this._absoluteUrl(value, baseUrl);
        if (
          image &&
          image.indexOf("imagecover") === -1 &&
          image.indexOf("mwmissing") === -1 &&
          !seen.has(image)
        ) {
          seen.add(image);
          images.push(image);
        }
      }
      document.dispose();
      if (images.length === 0) {
        throw "章节页面中没有找到漫画图片，可能需要登录或更新站点地址";
      }
      return { images };
    },

    onImageLoad: (url) => {
      const baseUrl = this.loadData("active_base_url") || this.baseUrls[0];
      return {
        url,
        headers: {
          "User-Agent": MANWA_USER_AGENT,
          Referer: baseUrl + "/",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
      };
    },

    onThumbnailLoad: (url) => {
      const baseUrl = this.loadData("active_base_url") || this.baseUrls[0];
      return {
        url,
        headers: {
          "User-Agent": MANWA_USER_AGENT,
          Referer: baseUrl + "/",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
      };
    },
  };
}
