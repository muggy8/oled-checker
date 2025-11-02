import { src, dest, series, parallel } from 'gulp'
import gulpTerser from 'gulp-terser'
import gulpCleanCSS from 'gulp-clean-css'
import CleanCSS from 'clean-css'
import imagemin from 'gulp-imagemin'
import htmlmin from 'gulp-htmlmin'
import jsonminify from 'gulp-jsonminify'
import replace from 'gulp-async-replace'
import { minify } from "terser"


const sourceDir = "src"
const outputDir = "docs"
const cleanCss = new CleanCSS({})

export const copy = function() {
	return src([
		`${sourceDir}/**/*.*`,
		`${sourceDir}/*.*`,
		`!${sourceDir}/*.md`,
		`!${sourceDir}/*.png`,
		`!${sourceDir}/*.svg`,
		`!${sourceDir}/*.webp`,
		`!${sourceDir}/*.ico`,
		`!${sourceDir}/**/*.md`,
		`!${sourceDir}/**/*.png`,
		`!${sourceDir}/**/*.svg`,
		`!${sourceDir}/**/*.webp`,
		`!${sourceDir}/**/*.ico`,
	])
	.pipe(dest(outputDir))
}

export const minifyJs = function() {
	return src([
		`${sourceDir}/*.js`,
		`${sourceDir}/**/*.js`
	])
		.pipe(gulpTerser())
		.pipe(dest(outputDir))
}

export const minifyCss = function() {
	return src([
		`${sourceDir}/*.css`,
		`${sourceDir}/**/*.css`
	])
		.pipe(gulpCleanCSS())
		.pipe(dest(outputDir))
}

export const minifyHtml = function() {
	return src([
		`${sourceDir}/*.html`,
		`${sourceDir}/**/*.html`,
	])
		.pipe(htmlmin({ collapseWhitespace: true }))
		.pipe(replace(/<style[^>]*>(.+?)<\/style>/gs, function(match, cssCode){
            // console.log("css replace", {match, cssCode})

			const cleanedCss = cleanCss.minify(cssCode)
			return match.replace(cssCode, cleanedCss.styles)
		}))
		.pipe(replace(/<script[^>]*>(.+?)<\/script>/gs, async function(match){
            let jsCode = match
                .replace(/<script[^>]*>/gs, '')
                .replace(/<\/script>/gs, '')

			const minifiedJs = await minify(jsCode)
			return match.replace(jsCode, minifiedJs.code)
		}))
		.pipe(dest(outputDir))
}

export const minifyJson = function(){
	return src([
			`${sourceDir}/*.json`,
			`${sourceDir}/*.webmanifest`,
			`${sourceDir}/**/*.json`,
			`${sourceDir}/**/*.webmanifest`,
		])
		.pipe(jsonminify())
		.pipe(dest(outputDir))
}

export const copyArt = function() {
	return src([
		`${sourceDir}/*.png`,
		`${sourceDir}/*.svg`,
		`${sourceDir}/*.webp`,
		`${sourceDir}/*.ico`,
		`${sourceDir}/**/*.png`,
		`${sourceDir}/**/*.svg`,
		`${sourceDir}/**/*.webp`,
		`${sourceDir}/**/*.ico`,
	], { encoding: false })
	.pipe(dest(outputDir))
}

export const minifyArt = function() {
	return src([
		`${sourceDir}/*.png`,
		`${sourceDir}/*.svg`,
		`${sourceDir}/*.webp`,
		`${sourceDir}/**/*.png`,
		`${sourceDir}/**/*.svg`,
		`${sourceDir}/**/*.webp`,
	], { encoding: false })
		.pipe(imagemin())
		.pipe(dest(outputDir))
}

export const code = series(
	copy,
	parallel(
		minifyJs,
		minifyCss,
		minifyHtml,
		minifyJson,
	),
)

export const art = series(
	copyArt,
	minifyArt,
)

export const all = series(
	copy,
	parallel(
		minifyJs,
		minifyCss,
		minifyHtml,
		minifyJson,
	),
	copyArt,
	minifyArt,
)

export default code