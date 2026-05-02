# frozen_string_literal: true

# Local Slim template support for Bridgetown 2.x
# Adapted from the deprecated bridgetown-slim gem
# https://github.com/bridgetownrb/bridgetown-slim

require "slim"

module Bridgetown
  class SlimView < RubyTemplateView
    # Register .slim extension for this view class
    input :slim

    # Support mixed template formats: .slim partials rendered directly,
    # other formats delegated to parent class
    def partial(partial_name = nil, **options, &block)
      return super if partial_name.nil?

      partial_segments = partial_name.split("/")
      partial_segments.last.sub!(%r!^!, "_")
      resolved_name = partial_segments.join("/")

      partials_dir = site.in_source_dir(site.config[:partials_dir])
      slim_path = File.join(partials_dir, "#{resolved_name}.slim")

      if File.exist?(slim_path)
        # Merge :locals into options if present (for backward compatibility)
        render_options = options[:locals] ? options.merge(options[:locals]) : options
        Slim::Template.new(slim_path).render(self, render_options, &block)
      else
        # Delegate to parent for non-Slim partials (erb, liquid, etc.)
        super(partial_name, **options, &block)
      end
    end
  end

  module Converters
    class SlimTemplates < Converter
      priority :highest
      input :slim

      # Logic to do the Slim content conversion.
      #
      # @param content [String] Content of the file (without front matter).
      # @param convertible [Bridgetown::Resource::Base, Bridgetown::Layout]
      #   The instantiated object which is processing the file.
      #
      # @return [String] The converted content.
      def convert(content, convertible)
        return content if convertible.data[:template_engine].to_s != "slim"

        slim_view = Bridgetown::SlimView.new(convertible)
        slim_renderer = Slim::Template.new(convertible.relative_path.to_s) { content }

        if convertible.is_a?(Bridgetown::Layout)
          slim_renderer.render(slim_view) do
            convertible.current_document_output
          end
        else
          slim_renderer.render(slim_view)
        end
      end

      def matches(ext, convertible)
        return true if convertible.data[:template_engine].to_s == "slim"

        super(ext).tap do |ext_matches|
          convertible.data[:template_engine] = "slim" if ext_matches
        end
      end

      def output_ext(ext)
        ext == ".slim" ? ".html" : ext
      end
    end
  end
end
